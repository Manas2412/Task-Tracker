import Link from 'next/link';

import { cn } from '@/lib/utils';

import type { TaskFilter } from '@/lib/visibility';

/**
 * Filter chip strip — Server Component.
 * Each chip is a Link that updates ?filter=, no client JS, no hydration.
 *
 * Layout:
 *   - mobile: horizontal scroll, snap-x
 *   - tablet+: wraps freely, no scroll
 */

// Due today / Overdue / Completed / Owned by me are surfaced as clickable
// drill-downs on the stats panel instead of as filter chips.
const CHIPS: { id: TaskFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'js_priority', label: 'JS Priority' },
];

export function FilterChips({ active }: { active: TaskFilter }) {
  return (
    <nav
      aria-label="Filter tasks"
      className="flex gap-1.5 overflow-x-auto md:overflow-visible md:flex-wrap snap-x snap-proximity [&::-webkit-scrollbar]:hidden -mx-1 px-1 py-1"
    >
      {CHIPS.map((chip) => {
        const isActive = chip.id === active;
        const href = chip.id === 'all' ? '/tasks' : `/tasks?filter=${chip.id}`;
        return (
          <Link
            key={chip.id}
            href={href}
            scroll={false}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap px-[11px] py-[5px] rounded-[14px] text-[12px] font-medium border transition-colors snap-start',
              isActive
                ? 'bg-ink text-white border-ink'
                : 'bg-panel text-ink-2 border-line hover:border-ink-4',
            )}
          >
            {chip.label}
          </Link>
        );
      })}
    </nav>
  );
}
