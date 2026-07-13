'use client';

import { useMemo, type MouseEvent } from 'react';

import { DocumentCard, type DocumentCardProps } from '@/components/ui/DocumentCard';
import { DocumentActionModal } from '@/components/ui/DocumentActionModal';
import { DocumentDetailSlideOver } from '@/components/ui/DocumentDetailSlideOver';
import { useTaskCardGestures } from '@/components/ui/useTaskCardGestures';
import { cn } from '@/lib/utils';

/**
 * Mobile gesture layer around a Document Record card — the same swipe + hold
 * interaction as the task cards (useTaskCardGestures), applied here for
 * consistency across the platform's list cards.
 *
 *   - swipe left  → right-side read-only slide-over (subject / urgency / status)
 *   - long press  → centered quick-action modal (review / awaiting / completed)
 *   - tap         → navigates to the record (unchanged)
 *
 * All gesture handling is touch-only and no-ops on desktop (the hook attaches
 * no listeners on precise-pointer / ≥768px), so desktop click-to-open is
 * untouched. `canAct` gates the long press; every action re-authorizes
 * server-side (Document Centre access).
 */

export type DocumentCardInteractiveProps = DocumentCardProps & {
  canAct: boolean;
};

const RING_DEADZONE = 0.12; // hide the progress ring until a real hold begins
const RING_R = 20;
const RING_C = 2 * Math.PI * RING_R;

function formatCreated(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export function DocumentCardInteractive(props: DocumentCardInteractiveProps) {
  const { canAct, ...cardProps } = props;
  const longPressEnabled = canAct;

  const {
    ref,
    phase,
    swipeOffset,
    isDragging,
    longPressProgress,
    suppressClickRef,
    isMobile,
    closeOverlay,
  } = useTaskCardGestures({ longPressEnabled });

  // Memoize the card subtree so swipe/long-press state changes only update the
  // wrapper transform + the progress ring — never re-render the card itself.
  // Depend on the stable `props` reference (unchanged across the hook's own
  // state updates); DocumentCard ignores the extra `canAct` prop.
  const card = useMemo(() => <DocumentCard {...props} />, [props]);

  const onClickCapture = (e: MouseEvent) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const showRing = longPressEnabled && longPressProgress > RING_DEADZONE;
  const href = cardProps.href ?? `/document-centre/${cardProps.id}`;

  return (
    <div className="relative">
      {/* Swipe hint — a chevron peeking from the right, fading in with the peek. */}
      <div
        aria-hidden="true"
        className="md:hidden pointer-events-none absolute inset-y-0 right-2 flex items-center text-ink-3"
        style={{ opacity: Math.min(1, Math.abs(swipeOffset) / 40) }}
      >
        <i className="ti ti-chevron-left text-[18px]" />
      </div>

      {/* Swipe surface — the card follows the finger; tap still navigates. On a
          touch phone we suppress native link/text behaviours (iOS callout,
          Android context-menu, selection, tap highlight) so they don't cancel a
          hold/slow swipe. Scoped to isMobile so desktop behaviour is untouched. */}
      <div
        ref={ref}
        onClickCapture={onClickCapture}
        onContextMenu={isMobile ? (e) => e.preventDefault() : undefined}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isDragging ? 'none' : 'transform 200ms ease-out',
          touchAction: 'pan-y',
          ...(isMobile
            ? {
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
              }
            : {}),
        }}
        className="relative"
      >
        {card}

        {/* Long-press progress ring (indigo system chrome — not amber). */}
        {showRing ? (
          <div
            aria-hidden="true"
            className="md:hidden pointer-events-none absolute inset-0 grid place-items-center"
          >
            <svg width="52" height="52" viewBox="0 0 52 52" className="rotate-[-90deg]">
              <circle cx="26" cy="26" r={RING_R} fill="none" className="stroke-line-2" strokeWidth="3" />
              <circle
                cx="26"
                cy="26"
                r={RING_R}
                fill="none"
                className="stroke-primary"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - longPressProgress)}
              />
            </svg>
          </div>
        ) : null}
      </div>

      <DocumentDetailSlideOver
        open={phase === 'slideover'}
        onClose={closeOverlay}
        href={href}
        subject={cardProps.subject}
        urgency={cardProps.urgency}
        status={cardProps.status}
        markedForReview={cardProps.markedForReview}
        awaitingInput={cardProps.awaitingInput}
        createdByName={cardProps.createdByName}
        createdAtLabel={formatCreated(cardProps.createdAt)}
        hasAttachment={cardProps.hasAttachment}
      />

      <DocumentActionModal
        open={phase === 'modal'}
        onClose={closeOverlay}
        documentId={cardProps.id}
        subject={cardProps.subject}
        markedForReview={cardProps.markedForReview}
        awaitingInput={cardProps.awaitingInput}
        status={cardProps.status}
      />
    </div>
  );
}
