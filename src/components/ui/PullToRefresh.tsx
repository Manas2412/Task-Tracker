'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';

/**
 * Pull-to-refresh — touch-only, mobile-friendly.
 *
 * The user pulls down past the threshold while at scroll-top of the
 * scroll container; releasing triggers `router.refresh()` (or the custom
 * onRefresh prop). Desktop is a no-op pass-through.
 *
 * Implementation: read window scrollY at touchstart. If user pulls and
 * scrollY === 0 we start tracking. We use a vertical translate-y on the
 * content; the indicator floats above showing progress.
 */

const TRIGGER_THRESHOLD = 70; // px — past this on release, refresh fires
const RESISTANCE = 0.5; // visual drag is half the actual movement past 0

type PullToRefreshProps = {
  children: React.ReactNode;
  /** Override the default router.refresh() */
  onRefresh?: () => void | Promise<void>;
  className?: string;
};

export function PullToRefresh({ children, onRefresh, className }: PullToRefreshProps) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startY = useRef(0);
  const isPulling = useRef(false);
  const startScroll = useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    if (refreshing) return;
    // Only engage if user is at the very top of the page
    if (window.scrollY > 0) {
      isPulling.current = false;
      return;
    }
    startY.current = e.touches[0].clientY;
    startScroll.current = window.scrollY;
    isPulling.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      // Scrolling back up — release
      setPull(0);
      return;
    }
    // Apply resistance: dragging gets progressively harder
    const eased = dy * RESISTANCE;
    setPull(Math.min(eased, TRIGGER_THRESHOLD * 1.6));
  };

  const onTouchEnd = async () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pull >= TRIGGER_THRESHOLD) {
      setRefreshing(true);
      try {
        if (onRefresh) {
          await onRefresh();
        } else {
          router.refresh();
          // Give the server render a moment so the spinner doesn't vanish instantly
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  };

  const armed = pull >= TRIGGER_THRESHOLD;

  return (
    <div
      className={cn('relative', className)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        aria-hidden="true"
        className="md:hidden absolute left-0 right-0 -top-12 flex justify-center pointer-events-none"
        style={{
          transform: `translateY(${pull}px)`,
          opacity: pull > 8 ? 1 : 0,
          transition: isPulling.current || refreshing ? 'none' : 'transform 220ms ease-out, opacity 220ms',
        }}
      >
        <div
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-panel border border-line text-[11px] font-medium',
            armed || refreshing ? 'text-primary' : 'text-ink-3',
          )}
        >
          <i
            className={cn(
              'ti text-[13px] transition-transform',
              refreshing
                ? 'ti-loader-2 animate-spin'
                : armed
                  ? 'ti-arrow-up'
                  : 'ti-arrow-down',
              !refreshing && armed ? 'rotate-180' : '',
            )}
            aria-hidden="true"
          />
          {refreshing ? 'Refreshing…' : armed ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      </div>

      <div
        style={{
          transform: `translateY(${pull}px)`,
          transition: isPulling.current ? 'none' : 'transform 220ms ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
