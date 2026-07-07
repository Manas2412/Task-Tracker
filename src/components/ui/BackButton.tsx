'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';

type BackButtonProps = {
  /** Where to go on a fresh load, when there is no in-app history to return to. */
  fallbackHref: string;
  label: string;
  /** Hide the text label below md (the arrow stays). */
  hideLabelOnMobile?: boolean;
  /** 'header' = quiet header link (default); 'button' = solid pill. */
  variant?: 'header' | 'button';
  className?: string;
};

const VARIANT_CLASS: Record<'header' | 'button', string> = {
  header: 'text-[13px] font-medium text-ink-2 hover:text-ink',
  button:
    'px-3.5 py-2 rounded-lg bg-ink text-white text-[13px] font-medium hover:bg-ink-2',
};

/**
 * Consistent back control. Returns to the previous page via the browser
 * history, which restores its URL — so the list's filters and query string
 * survive — and its scroll position. Falls back to `fallbackHref` only when
 * the page was opened directly (a fresh tab, a shared link, a notification)
 * and there is nothing to go back to. Use this instead of a hard-coded
 * `<Link href="/tasks">`, which always drops the caller's context.
 */
export function BackButton({
  fallbackHref,
  label,
  hideLabelOnMobile,
  variant = 'header',
  className,
}: BackButtonProps) {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    // > 1 means we soft-navigated here from another page in this tab, so
    // history.back() lands on it with its query string and scroll intact.
    setCanGoBack(window.history.length > 1);
  }, []);

  return (
    <button
      type="button"
      onClick={() => (canGoBack ? router.back() : router.push(fallbackHref))}
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-1.5 transition-colors',
        VARIANT_CLASS[variant],
        className,
      )}
    >
      <i className="ti ti-arrow-left text-[16px]" aria-hidden="true" />
      <span className={hideLabelOnMobile ? 'hidden md:inline' : undefined}>{label}</span>
    </button>
  );
}
