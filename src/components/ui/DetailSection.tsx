import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * DetailSection — the single canonical section shell for detail pages
 * (task, subtask, timeline file). Freezes one header cadence (mb-3), one
 * uppercase label voice (.section-label), and one count-span spelling, so
 * the many hand-rolled sections can no longer drift apart.
 *
 * Presentational server component. Pass the section's existing
 * `labelledById` to preserve its aria-labelledby wiring.
 */
type DetailSectionProps = {
  title: string;
  /** Optional count shown after the title (only rendered when > 0). */
  count?: number;
  /** Unit label after the count, e.g. "files" -> "3 files". */
  countLabel?: string;
  /** Trailing control aligned to the header's right edge (e.g. an Add button). */
  action?: ReactNode;
  /** Id applied to the heading + section aria-labelledby. */
  labelledById?: string;
  className?: string;
  children: ReactNode;
};

export function DetailSection({
  title,
  count,
  countLabel,
  action,
  labelledById,
  className,
  children,
}: DetailSectionProps) {
  return (
    <section
      aria-labelledby={labelledById}
      className={cn('px-4 md:px-6 py-5 border-b border-line-2', className)}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id={labelledById} className="section-label">
          {title}
          {count != null && count > 0 ? (
            <span className="ml-2 text-ink-3 text-[11px] tracking-normal normal-case font-normal">
              {count}
              {countLabel ? ` ${countLabel}` : ''}
            </span>
          ) : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
