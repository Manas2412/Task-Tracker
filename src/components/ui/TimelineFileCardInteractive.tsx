'use client';

import { useMemo, type MouseEvent } from 'react';

import { TimelineFileCard } from '@/components/ui/TimelineFileCard';
import { TimelineFileDetailSlideOver } from '@/components/ui/TimelineFileDetailSlideOver';
import { useTaskCardGestures } from '@/components/ui/useTaskCardGestures';
import type { SlideOverDoc } from '@/components/ui/SlideOverShell';

/**
 * Mobile gesture layer around a Timeline File card.
 *
 *   - swipe left → right-side read-only slide-over (subject/status/docs)
 *   - tap        → navigates to the file (unchanged)
 *
 * Swipe-only: unlike task cards there is no long-press action modal (a Timeline
 * File has no equivalent quick-action set here), so `longPressEnabled` is off.
 * All gesture handling is touch-only and no-ops on desktop, leaving the plain
 * card link behaviour untouched.
 */

export type TimelineFileCardInteractiveProps = {
  refNo: string;
  subject: string;
  fromWhom: string;
  receivedDate: Date;
  deadlineDate: Date | null;
  status: string;
  priority: string;
  markedTo: Array<{ id: string; name: string; avatarColour: string }>;
  taskLinkCount: number;
  href: string;
  sourceDocs: SlideOverDoc[];
  actionDocs: SlideOverDoc[];
};

export function TimelineFileCardInteractive(props: TimelineFileCardInteractiveProps) {
  const { ref, phase, swipeOffset, isDragging, suppressClickRef, isMobile, closeOverlay } =
    useTaskCardGestures({ longPressEnabled: false });

  // Memoize the card so swipe-follow state changes only update the wrapper
  // transform, never re-render the card itself. The destructure lives inside so
  // `props` is the sole dependency.
  const card = useMemo(() => {
    const { sourceDocs: _s, actionDocs: _a, ...cardProps } = props;
    return <TimelineFileCard {...cardProps} variant="full" />;
  }, [props]);

  const onClickCapture = (e: MouseEvent) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

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

      {/* Swipe surface — the card follows the finger; tap still navigates. */}
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
      </div>

      <TimelineFileDetailSlideOver
        open={phase === 'slideover'}
        onClose={closeOverlay}
        href={props.href}
        refNo={props.refNo}
        subject={props.subject}
        fromWhom={props.fromWhom}
        receivedDate={props.receivedDate}
        deadlineDate={props.deadlineDate}
        status={props.status}
        priority={props.priority}
        markedTo={props.markedTo}
        taskLinkCount={props.taskLinkCount}
        sourceDocs={props.sourceDocs}
        actionDocs={props.actionDocs}
      />
    </div>
  );
}
