'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * Dark-mode toggle for the top bar.
 *
 * The active theme is applied to <html data-theme> pre-paint by the init
 * script in the root layout (so there is no flash), and persisted to
 * localStorage. This button flips it, re-persists, and briefly adds the
 * `.theme-transition` class so the colour swap cross-fades smoothly (the
 * reduced-motion floor turns that into an instant swap).
 *
 * Sun ⇄ moon cross-fade with a quarter-turn rotation for a premium feel.
 */
export function ThemeToggle() {
  // Null until mounted, so the server render and first client render agree
  // (no hydration mismatch); resolved from the attribute the init script set.
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'dark' : 'light');
  }, []);

  const isDark = theme === 'dark';

  const toggle = () => {
    const next = isDark ? 'light' : 'dark';
    const root = document.documentElement;
    root.classList.add('theme-transition');
    root.setAttribute('data-theme', next);
    root.style.colorScheme = next;
    // Keep the browser chrome (mobile URL bar) tint matching the active theme.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'dark' ? '#0e0e11' : '#f5f4f0');
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Storage unavailable (private mode) — theme still applies for the session.
    }
    setTheme(next);
    window.setTimeout(() => root.classList.remove('theme-transition'), 450);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      onClick={toggle}
      className="relative w-9 h-9 grid place-items-center rounded-full text-ink-2 hover:bg-line-2 hover:text-ink transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
    >
      <i
        className={cn(
          'ti ti-sun absolute text-[19px] transition-all duration-300 ease-out motion-reduce:transition-none',
          isDark ? 'opacity-0 -rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100',
        )}
        aria-hidden="true"
      />
      <i
        className={cn(
          'ti ti-moon absolute text-[18px] transition-all duration-300 ease-out motion-reduce:transition-none',
          isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50',
        )}
        aria-hidden="true"
      />
    </button>
  );
}
