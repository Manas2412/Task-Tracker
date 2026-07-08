'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * A stylish disclosure used to tuck a page's secondary sections (details,
 * tags, activity) into one collapsible panel at the bottom of a detail
 * screen. Shared across Tasks, Subtasks (same page), and Timeline Files for a
 * consistent interaction.
 *
 * - Header is a real disclosure button (`aria-expanded` / `aria-controls`).
 * - Body animates open/closed via the `grid-template-rows` 0fr→1fr trick and
 *   is marked `inert` while collapsed, so hidden controls stay out of the tab
 *   order and the accessibility tree.
 * - Children are server- or client-rendered sections passed straight through;
 *   they keep their own headings and styling.
 */
type CollapsibleSectionProps = {
  /** Button label, e.g. "Task details" / "File details". Sentence case. */
  title: string;
  /** Optional one-line hint of what's inside, shown under the title. */
  subtitle?: string;
  /** Tabler icon class for the leading chip, e.g. "ti-list-details". */
  icon?: string;
  /** Start expanded. Defaults to collapsed (hidden until opened). */
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function CollapsibleSection({
  title,
  subtitle,
  icon = 'ti-list-details',
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);

  // Keep collapsed content out of the tab order + a11y tree while animating.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (open) el.removeAttribute('inert');
    else el.setAttribute('inert', '');
  }, [open]);

  return (
    <section className="border-t border-line-2">
      <h2 className="m-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className={cn(
            'group flex w-full items-center gap-3 px-4 md:px-6 py-3.5 text-left transition-colors',
            open ? 'bg-primary-soft/50' : 'hover:bg-bg/60',
          )}
        >
          <span
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors',
              open
                ? 'border-primary-line bg-primary-soft text-primary'
                : 'border-line bg-panel text-ink-2 group-hover:border-ink-4',
            )}
          >
            <i className={cn('ti text-[17px]', icon)} aria-hidden="true" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium text-ink">{title}</span>
            {subtitle ? (
              <span className="mt-0.5 block truncate text-[11px] text-ink-3">{subtitle}</span>
            ) : null}
          </span>

          <span className="text-[11px] font-medium text-ink-3 shrink-0 hidden sm:block">
            {open ? 'Hide' : 'Show'}
          </span>
          <span
            className={cn(
              'grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-3 transition-all duration-300',
              'group-hover:bg-line-2',
              open && 'rotate-180',
            )}
          >
            <i className="ti ti-chevron-down text-[16px]" aria-hidden="true" />
          </span>
        </button>
      </h2>

      <div
        id={panelId}
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div ref={bodyRef} className="overflow-hidden">
          {children}
        </div>
      </div>
    </section>
  );
}
