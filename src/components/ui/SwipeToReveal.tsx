'use client';

import { useRef, useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * Touch-driven swipe-to-reveal-action wrapper.
 *
 * Swipe LEFT on the child to reveal an action button on the RIGHT. Tap the
 * action to fire it. Tap the child area (or swipe back) to snap closed.
 *
 *   - Touch-only by design: no mouse handlers. On desktop the wrapper is
 *     transparent; the child behaves normally.
 *   - Vertical scroll wins: if the user drags more vertically than
 *     horizontally on the first move, we abort and don't intercept the
 *     scroll.
 *   - The reveal width is the width of the action button (≈ 80 px).
 *
 * Disabled (no `action` prop) → renders children with no overhead.
 */

const ACTION_WIDTH = 80; // px
const TRIGGER_THRESHOLD = 40; // px — past this on release, the reveal sticks open
const ABORT_VERTICAL = 6; // px — vertical drag wins past this

type ActionTone = 'danger' | 'primary' | 'neutral' | 'info';

type SwipeAction = {
  label: string;
  icon: string;
  tone?: ActionTone;
  onAction: () => void | Promise<void>;
};

type SwipeToRevealProps = {
  action?: SwipeAction;
  children: React.ReactNode;
  className?: string;
};

const TONE_BG: Record<ActionTone, string> = {
  danger: 'bg-urgent text-white',
  primary: 'bg-primary text-white',
  info: 'bg-info text-white',
  neutral: 'bg-ink text-white',
};

export function SwipeToReveal({ action, children, className }: SwipeToRevealProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Tracking
  const startX = useRef(0);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const directionLocked = useRef<'h' | 'v' | null>(null);

  // If no action, just render children — no event listeners.
  if (!action) {
    return <div className={className}>{children}</div>;
  }

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    isDragging.current = true;
    directionLocked.current = null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;

    if (directionLocked.current === null) {
      // Decide direction on first meaningful movement
      if (Math.abs(dy) > ABORT_VERTICAL && Math.abs(dy) > Math.abs(dx)) {
        directionLocked.current = 'v';
        isDragging.current = false;
        return;
      }
      if (Math.abs(dx) > 6) {
        directionLocked.current = 'h';
      } else {
        return;
      }
    }

    if (directionLocked.current === 'h') {
      // Only allow left swipes (negative dx). If currently open, allow right
      // swipe up to 0.
      const base = open ? -ACTION_WIDTH : 0;
      let next = Math.min(0, base + dx);
      if (next < -ACTION_WIDTH * 1.5) next = -ACTION_WIDTH * 1.5;
      setOffset(next);
    }
  };

  const onTouchEnd = () => {
    isDragging.current = false;
    if (directionLocked.current !== 'h') {
      directionLocked.current = null;
      return;
    }
    directionLocked.current = null;
    if (offset <= -TRIGGER_THRESHOLD) {
      setOffset(-ACTION_WIDTH);
      setOpen(true);
    } else {
      setOffset(0);
      setOpen(false);
    }
  };

  const fire = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await action.onAction();
    } finally {
      setBusy(false);
      setOpen(false);
      setOffset(0);
    }
  };

  // Tap anywhere on the moving child closes the reveal too.
  const onTapChild = () => {
    if (open) {
      setOpen(false);
      setOffset(0);
    }
  };

  return (
    <div
      ref={wrapRef}
      className={cn('relative overflow-hidden rounded-xl', className)}
    >
      {/* Action button on the right */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ width: ACTION_WIDTH }}
        aria-hidden={!open}
      >
        <button
          type="button"
          onClick={fire}
          disabled={busy}
          aria-label={action.label}
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium',
            TONE_BG[action.tone ?? 'neutral'],
            busy && 'opacity-60',
          )}
        >
          <i className={cn('ti', action.icon, 'text-[18px]')} aria-hidden="true" />
          {action.label}
        </button>
      </div>

      {/* Swipeable content */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onTapChild}
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging.current ? 'none' : 'transform 200ms ease-out',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}
