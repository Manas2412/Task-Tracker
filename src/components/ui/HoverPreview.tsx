'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * HoverPreview — a lightweight hover-card.
 *
 * Wraps a trigger (e.g. a task card) and shows `content` in a floating
 * panel while the mouse is over it. The panel is rendered in a portal on
 * document.body with fixed positioning, so it is never clipped by an
 * ancestor's `overflow-hidden`. It
 * flips above the trigger near the bottom of the viewport and is clamped
 * horizontally. Mouse-only: touch (which has no hover) never triggers it,
 * and it also appears on keyboard focus for accessibility.
 */

const TIP_WIDTH = 300;
const GAP = 8;
const SHOW_DELAY_MS = 120;

type Placement = 'top' | 'bottom';
type Pos = { top: number; left: number; placement: Placement };

type HoverPreviewProps = {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function HoverPreview({ content, children, className }: HoverPreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const placement: Placement = spaceBelow < 220 && r.top > 220 ? 'top' : 'bottom';
    let left = r.left;
    if (left + TIP_WIDTH > window.innerWidth - GAP) left = window.innerWidth - GAP - TIP_WIDTH;
    if (left < GAP) left = GAP;
    const top = placement === 'bottom' ? r.bottom + GAP : r.top - GAP;
    setPos({ top, left, placement });
  }, []);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const onPointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return; // hover is a mouse affordance
    clearTimer();
    timer.current = setTimeout(place, SHOW_DELAY_MS);
  };

  const hide = useCallback(() => {
    clearTimer();
    setPos(null);
  }, []);

  // A fixed-positioned panel would detach from its trigger once the page
  // scrolls or resizes, so dismiss it instead of letting it float.
  useEffect(() => {
    if (!pos) return;
    const onScroll = () => hide();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [pos, hide]);

  return (
    <div
      ref={ref}
      className={className}
      onPointerEnter={onPointerEnter}
      onPointerLeave={hide}
      onFocusCapture={place}
      onBlurCapture={hide}
    >
      {children}

      {pos && content && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="tooltip"
              className="fixed z-50 pointer-events-none"
              style={{
                top: pos.top,
                left: pos.left,
                width: TIP_WIDTH,
                maxWidth: 'calc(100vw - 16px)',
                transform: pos.placement === 'top' ? 'translateY(-100%)' : undefined,
              }}
            >
              <div className="hover-pop">{content}</div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
