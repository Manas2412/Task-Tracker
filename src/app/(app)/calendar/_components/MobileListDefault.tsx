'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Defaults the calendar to the list view on mobile. The server already picks
 * list for mobile user-agents (so real phones get it flash-free); this covers
 * narrow viewports the UA check can't see — e.g. a resized desktop window.
 * It never overrides an explicit ?view= choice and no-ops once list is shown.
 */
export function MobileListDefault({
  resolvedView,
  hasExplicitView,
}: {
  resolvedView: 'month' | 'week' | 'list';
  hasExplicitView: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (hasExplicitView || resolvedView === 'list') return;
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', 'list');
    router.replace(`/calendar?${params.toString()}`, { scroll: false });
  }, [hasExplicitView, resolvedView, router, searchParams]);

  return null;
}
