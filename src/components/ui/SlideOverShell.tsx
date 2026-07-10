'use client';

import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';
import { useOverlayLifecycle } from '@/components/ui/useOverlayLifecycle';

/**
 * Shared mobile "mini side popup" chrome for the read-only card previews
 * (task cards + timeline-file cards). Opened by swiping a card left.
 *
 * Deliberately NOT a full-height drawer: the panel is a compact popup anchored
 * to the right edge and centred vertically (`max-h-[80dvh]`, so it never spans
 * top-to-bottom), washed in a very light indigo. It slides in from the right,
 * dims the list behind it, and closes via the back arrow, a tap on the dim
 * overlay, Escape, or — the mobile affordance — a right-swipe on the panel.
 *
 * Read-only: all data comes from props; each caller passes its own body via
 * `children` plus a "Open full …" link.
 */

const EXIT_MS = 260;
const CLOSE_SWIPE_TRIGGER = 64; // px right-drag on release dismisses the popup
const CLOSE_FLICK_VELOCITY = 0.5; // px/ms — a fast right flick dismisses below the distance threshold
const AXIS_LOCK_SLOP = 8; // px — first move past this locks the axis

export type SlideOverShellProps = {
  open: boolean;
  onClose: () => void;
  /** Small uppercase eyebrow — "Task" / "Timeline file". */
  eyebrow: string;
  /** Optional mono reference shown under the eyebrow. */
  refNumber?: string | null;
  /** id of the body's heading element, for aria-labelledby. */
  labelledById: string;
  closeLabel: string;
  children: ReactNode;
};

export function SlideOverShell({
  open,
  onClose,
  eyebrow,
  refNumber,
  labelledById,
  closeLabel,
  children,
}: SlideOverShellProps) {
  const backRef = useRef<HTMLButtonElement>(null);
  const { render, shown, portalTarget } = useOverlayLifecycle(open, onClose, EXIT_MS, backRef);

  // Right-swipe-to-close. Tracked locally so the finger-follow only re-renders
  // this panel, never the card list behind it.
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startT = useRef(0);
  const axis = useRef<null | 'h' | 'v'>(null);

  // Reset the drag only once the panel is fully unmounted, so a swipe-close
  // animates out from where the finger left it (no jump back to 0 mid-exit).
  useEffect(() => {
    if (!render) {
      setDragX(0);
      setDragging(false);
      axis.current = null;
    }
  }, [render]);

  // Also reset on every (re)open: the swipe-close path deliberately leaves the
  // offset in place to animate out, and the unmount is deferred by EXIT_MS — so
  // a fast dismiss-then-reopen of the SAME card could otherwise reopen the panel
  // stuck at the previous swipe offset. Resetting here lands it at rest.
  useEffect(() => {
    if (open) {
      setDragX(0);
      setDragging(false);
      axis.current = null;
    }
  }, [open]);

  if (!render || !portalTarget) return null;

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    startT.current = performance.now();
    axis.current = null;
  };

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (axis.current === null) {
      if (Math.abs(dx) > AXIS_LOCK_SLOP && Math.abs(dx) > Math.abs(dy)) {
        axis.current = 'h';
        setDragging(true);
      } else if (Math.abs(dy) > AXIS_LOCK_SLOP) {
        axis.current = 'v'; // let the panel scroll vertically
        return;
      } else {
        return;
      }
    }
    if (axis.current !== 'h') return;
    setDragX(Math.max(0, dx)); // right only
  };

  const onTouchEnd = () => {
    if (axis.current === 'h') {
      const dt = Math.max(1, performance.now() - startT.current);
      const vx = dragX / dt;
      const shouldClose = dragX > CLOSE_SWIPE_TRIGGER || vx > CLOSE_FLICK_VELOCITY;
      if (shouldClose) {
        // Leave dragX where it is — `shown` flips false and the panel animates
        // the rest of the way out to translateX(100%) from the current offset.
        setDragging(false);
        onClose();
      } else {
        setDragging(false);
        setDragX(0); // spring back
      }
    }
    axis.current = null;
  };

  const node = (
    <div className="md:hidden">
      {/* Dim overlay — tap to close */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200',
          shown ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />

      {/* Vertical-centring rail — only the panel itself is interactive, so taps
          above/below it fall through to the dim overlay and close the popup. */}
      <div className="fixed inset-y-0 right-0 z-[70] flex items-center pointer-events-none">
        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledById}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
          style={{
            transform: shown ? `translateX(${dragX}px)` : 'translateX(100%)',
            transition: dragging ? 'none' : `transform ${EXIT_MS}ms var(--ease-emphasis)`,
            touchAction: 'pan-y',
          }}
          className={cn(
            'pointer-events-auto w-[86vw] max-w-[340px] max-h-[80dvh] overflow-y-auto overscroll-contain',
            'bg-primary-tint border-y border-l border-primary-line/40 rounded-l-2xl',
            'shadow-[0_18px_50px_-12px_rgba(0,0,0,0.3)] will-change-transform',
            'motion-reduce:transition-none',
          )}
        >
          {/* Header — back arrow + eyebrow + optional ref */}
          <header className="sticky top-0 z-10 bg-primary-tint/95 backdrop-blur-sm border-b border-primary-line/30 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <button
                ref={backRef}
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="w-7 h-7 grid place-items-center rounded-full text-ink-2 hover:bg-primary-soft active:scale-95 transition-transform"
              >
                <i className="ti ti-arrow-left text-[17px]" aria-hidden="true" />
              </button>
              <div className="min-w-0">
                <p className="text-[9.5px] uppercase tracking-[0.08em] text-primary/70 font-medium leading-none">
                  {eyebrow}
                </p>
                {refNumber ? (
                  <p className="font-mono text-[10px] text-ink-3 leading-tight mt-0.5">{refNumber}</p>
                ) : null}
              </div>
              <span
                aria-hidden="true"
                className="ml-auto text-[10px] text-primary/45 inline-flex items-center gap-1"
              >
                <i className="ti ti-chevron-right text-[13px]" />
                Swipe
              </span>
            </div>
          </header>

          {children}
        </aside>
      </div>
    </div>
  );

  return createPortal(node, portalTarget);
}

/**
 * A tight labelled block inside a slide-over. Compressed padding so the popup
 * shows as much as possible without scrolling.
 */
export function SlideOverSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="px-3.5 py-2.5 border-t border-primary-line/25">
      <p className="text-[10px] uppercase tracking-[0.06em] text-primary/60 mb-1">{label}</p>
      {children}
    </section>
  );
}

export type SlideOverDoc = { id: string; fileName: string };

/**
 * Clickable document list for a slide-over. Each row opens the file in a new
 * tab through the shared `/api/attachments/:id/view` route (which re-authorises
 * the caller, presigns S3 uploads, and redirects drive links) — so a preview
 * can never reveal a file the caller could not already open on the detail page.
 */
export function SlideOverDocs({
  docs,
  emptyLabel,
}: {
  docs: SlideOverDoc[];
  emptyLabel: string;
}) {
  if (docs.length === 0) {
    return <p className="text-[12px] italic text-ink-3">{emptyLabel}</p>;
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {docs.map((d) => (
        <li key={d.id}>
          <a
            href={`/api/attachments/${d.id}/view`}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-1.5 min-w-0 py-1 text-[12.5px] text-primary hover:underline"
          >
            <i
              className={cn('ti shrink-0 text-[14px] text-primary/70', docIcon(d.fileName))}
              aria-hidden="true"
            />
            <span className="truncate">{d.fileName}</span>
            <i
              className="ti ti-external-link text-[11px] text-ink-3 shrink-0 ml-auto"
              aria-hidden="true"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}

function docIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'ti-file-type-pdf';
  if (ext === 'doc' || ext === 'docx') return 'ti-file-type-doc';
  if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return 'ti-file-type-xls';
  if (ext === 'ppt' || ext === 'pptx') return 'ti-file-type-ppt';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext)) return 'ti-photo';
  return 'ti-paperclip';
}
