import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * GlassDetailPanel — the frosted-glass shell shared by the task and
 * timeline-file detail pages, so both panels are pixel-consistent.
 *
 * Structure:
 *   - a soft brand-tinted ambient backdrop fills the page behind the panel
 *     (so the frost has something to blur — glass over a flat colour reads
 *     as nothing);
 *   - the panel frame carries the border / shadow / radius but NO filter;
 *   - a separate absolute `.glass-surface` layer provides the translucent
 *     fill + backdrop-blur. Keeping the filter off the panel element itself
 *     means the sticky sub-header inside `children` behaves normally.
 *
 * Legibility, fallback and reduced-transparency handling live in the CSS
 * classes (src/app/globals.css).
 */
export function GlassDetailPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="relative isolate min-h-dvh px-3 md:px-6 lg:px-8">
      <div
        aria-hidden="true"
        className="glass-ambient pointer-events-none absolute inset-0 -z-10"
      />
      <div
        className={cn(
          'glass-panel relative isolate mx-auto max-w-3xl xl:max-w-4xl my-4 md:my-6 pb-8',
          className,
        )}
      >
        <div
          aria-hidden="true"
          className="glass-surface pointer-events-none absolute inset-0 -z-10"
        />
        {children}
      </div>
    </div>
  );
}
