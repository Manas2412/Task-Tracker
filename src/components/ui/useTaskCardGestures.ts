import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Mobile task-card gesture FSM.
 *
 * Runs a single finite state machine over raw touch events to disambiguate:
 *   - tap                → let the underlying <Link> navigate (nothing to do)
 *   - vertical drag       → hand off to native scroll + PullToRefresh (untouched)
 *   - horizontal left drag→ peek, then open the right slide-over on release
 *   - long press (~2 s)   → open the centered action modal
 *
 * Load-bearing detail: the touch listeners are attached imperatively with
 * `{ passive: false }` so a horizontal drag can `preventDefault()` (stopping
 * page scroll / text-selection) WITHOUT React's default passive touchmove.
 * Vertical drags never `preventDefault` and no handler ever `stopPropagation`s,
 * so the ancestor PullToRefresh keeps receiving events and stays intact.
 *
 * Desktop / precise-pointer / ≥768px: the effect attaches nothing and the
 * machine stays `idle` forever — a pure pass-through.
 */

const DIR_LOCK_SLOP = 8; // px — first move past this locks the axis
const LONG_PRESS_SLOP = 16; // px — a hold that drifts past this (from the start point) cancels the long press. Generous so a real 2s finger-hold survives natural tremor.
const SWIPE_TRIGGER = 48; // px — left-drag past this on release opens the drawer
const RUBBER_START = 80; // px — resistance kicks in past this
const RUBBER_FACTOR = 0.35; // rubber-band factor beyond RUBBER_START
const MAX_PEEK = 104; // px — hard clamp on the peek
const LONG_PRESS_MS = 2000; // hold duration for the action modal
const FLICK_VELOCITY = 0.5; // px/ms — a fast left flick opens below the distance threshold
const SUPPRESS_RESET_MS = 350; // release the click-suppression shortly after close

export type OverlayPhase = 'idle' | 'slideover' | 'modal';

export interface TaskCardGestures {
  /** Attach to the swipe surface (the element that also carries the translateX). */
  ref: React.RefObject<HTMLDivElement>;
  /** Which overlay (if any) is open. */
  phase: OverlayPhase;
  /** Current left-peek in px (≤ 0), for the follow transform. */
  swipeOffset: number;
  /** True while a horizontal drag is live (disable the spring transition). */
  isDragging: boolean;
  /** 0→1 over the long-press window; drives the progress ring. */
  longPressProgress: number;
  /** When true, the next click on the card is swallowed (a gesture just fired). */
  suppressClickRef: React.MutableRefObject<boolean>;
  /** True on a touch phone (coarse pointer, <md). Used to scope native-gesture
   *  suppression (callout / selection / context-menu) to mobile only. */
  isMobile: boolean;
  /** Close whichever overlay is open and return to idle. */
  closeOverlay: () => void;
}

export function useTaskCardGestures(opts: { longPressEnabled: boolean }): TaskCardGestures {
  const { longPressEnabled } = opts;

  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<OverlayPhase>('idle');
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [longPressProgress, setLongPressProgress] = useState(0);
  const suppressClickRef = useRef(false);

  // Whether the gesture machine is active — a coarse (touch) primary pointer on
  // a sub-md viewport. Tracked reactively so it can never diverge from the
  // overlays' `md:hidden` CSS (e.g. a tablet rotated portrait→landscape past
  // 768px tears the gestures down instead of leaving invisible-overlay dead zones).
  const [isMobile, setIsMobile] = useState(false);

  // Tracking (refs so the native listeners always read live values).
  const startX = useRef(0);
  const startY = useRef(0);
  const startT = useRef(0);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const curOffset = useRef(0);
  const lockedAxis = useRef<null | 'h' | 'v'>(null);
  const moved = useRef(false);
  const activePhase = useRef<OverlayPhase>('idle'); // gate: ignore gestures while an overlay is open
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafId = useRef<number | null>(null);
  const suppressResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeOverlay = useCallback(() => {
    activePhase.current = 'idle';
    setPhase('idle');
    // Keep suppression briefly so the dismissing tap can't also navigate.
    suppressClickRef.current = true;
    if (suppressResetTimer.current) clearTimeout(suppressResetTimer.current);
    suppressResetTimer.current = setTimeout(() => {
      suppressClickRef.current = false;
    }, SUPPRESS_RESET_MS);
    curOffset.current = 0;
    setSwipeOffset(0);
    setIsDragging(false);
  }, []);

  // Track the mobile breakpoint reactively (matches Tailwind's `md` = 768px and
  // the overlays' `md:hidden`). Re-evaluates on resize/rotation and pointer
  // changes, so listeners attach/detach in lock-step with overlay visibility.
  useEffect(() => {
    const widthMq = window.matchMedia('(max-width: 767px)');
    const coarseMq = window.matchMedia('(pointer: coarse)');
    const compute = () => setIsMobile(widthMq.matches && coarseMq.matches);
    compute();
    widthMq.addEventListener('change', compute);
    coarseMq.addEventListener('change', compute);
    return () => {
      widthMq.removeEventListener('change', compute);
      coarseMq.removeEventListener('change', compute);
    };
  }, []);

  // Leaving the mobile breakpoint while an overlay is open would strand it
  // behind `md:hidden` (invisible, scroll locked) — close it on the way out.
  // Guarded on an actually-open overlay so it never touches click-suppression
  // on mount or on desktop.
  useEffect(() => {
    if (!isMobile && phase !== 'idle') closeOverlay();
  }, [isMobile, phase, closeOverlay]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !isMobile) return;

    const clearTimers = () => {
      if (lpTimer.current) {
        clearTimeout(lpTimer.current);
        lpTimer.current = null;
      }
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      setLongPressProgress(0);
    };

    const softReset = () => {
      clearTimers();
      lockedAxis.current = null;
      moved.current = false;
      curOffset.current = 0;
      setIsDragging(false);
      setSwipeOffset(0);
    };

    const openPhase = (p: OverlayPhase) => {
      suppressClickRef.current = true;
      activePhase.current = p;
      setPhase(p);
    };

    const tickRing = () => {
      const p = Math.min(1, (performance.now() - startT.current) / LONG_PRESS_MS);
      setLongPressProgress(p);
      if (p < 1) rafId.current = requestAnimationFrame(tickRing);
    };

    const onStart = (e: TouchEvent) => {
      if (activePhase.current !== 'idle') return;
      if (e.touches.length !== 1) {
        softReset();
        return;
      }
      const t = e.touches[0];
      startX.current = t.clientX;
      startY.current = t.clientY;
      lastX.current = t.clientX;
      startT.current = performance.now();
      lastT.current = startT.current;
      curOffset.current = 0;
      lockedAxis.current = null;
      moved.current = false;
      suppressClickRef.current = false;

      if (longPressEnabled) {
        lpTimer.current = setTimeout(() => {
          // Only a real move (past LONG_PRESS_SLOP → moved=true) aborts the hold.
          // A tiny drift that merely locked an axis must NOT — that made the
          // effective tolerance 8px and killed most real 2s holds.
          if (moved.current) return;
          navigator.vibrate?.(10);
          openPhase('modal');
          softReset();
        }, LONG_PRESS_MS);
        rafId.current = requestAnimationFrame(tickRing);
      }
    };

    const onMove = (e: TouchEvent) => {
      if (activePhase.current !== 'idle') return;
      if (e.touches.length !== 1) {
        softReset();
        return;
      }
      const t = e.touches[0];
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;
      lastX.current = t.clientX;
      lastT.current = performance.now();

      // Real movement kills a pending long press (a hold stays near-stationary).
      // Uses the generous LONG_PRESS_SLOP so finger tremor over 2s doesn't abort it.
      if (Math.abs(dx) + Math.abs(dy) > LONG_PRESS_SLOP) {
        moved.current = true;
        clearTimers();
      }

      if (lockedAxis.current === null) {
        if (Math.abs(dy) > DIR_LOCK_SLOP && Math.abs(dy) > Math.abs(dx)) {
          lockedAxis.current = 'v'; // native scroll + PullToRefresh own it
          return;
        }
        if (Math.abs(dx) > DIR_LOCK_SLOP && Math.abs(dx) >= Math.abs(dy)) {
          lockedAxis.current = 'h';
          setIsDragging(true);
        } else {
          return;
        }
      }

      if (lockedAxis.current === 'v') return; // never preventDefault vertical

      if (lockedAxis.current === 'h') {
        if (e.cancelable) e.preventDefault(); // we own horizontal — stop page scroll / selection
        let next = Math.min(0, dx); // left only
        if (next < -RUBBER_START) {
          next = -RUBBER_START - (Math.abs(next) - RUBBER_START) * RUBBER_FACTOR;
        }
        if (next < -MAX_PEEK) next = -MAX_PEEK;
        curOffset.current = next;
        setSwipeOffset(next);
      }
    };

    const onEnd = () => {
      if (activePhase.current !== 'idle') return;
      clearTimers();
      if (lockedAxis.current === 'h') {
        const dt = Math.max(1, lastT.current - startT.current);
        const vx = (lastX.current - startX.current) / dt; // negative = left
        const openIt = curOffset.current <= -SWIPE_TRIGGER || vx < -FLICK_VELOCITY;
        setIsDragging(false);
        curOffset.current = 0;
        setSwipeOffset(0);
        if (openIt) openPhase('slideover');
      }
      lockedAxis.current = null;
      moved.current = false;
    };

    const onCancel = () => {
      // Browser reclaimed the gesture (e.g. scroll / pull-to-refresh). Bow out cleanly.
      if (activePhase.current !== 'idle') return;
      softReset();
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onCancel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onCancel);
      clearTimers();
      if (suppressResetTimer.current) clearTimeout(suppressResetTimer.current);
    };
  }, [longPressEnabled, isMobile]);

  return {
    ref,
    phase,
    swipeOffset,
    isDragging,
    longPressProgress,
    suppressClickRef,
    isMobile,
    closeOverlay,
  };
}
