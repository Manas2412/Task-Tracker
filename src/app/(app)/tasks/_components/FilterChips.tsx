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

const CHIPS: { id: TaskFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Due today' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'mine', label: 'Owned by me' },
  { id: 'urgent', label: 'Urgent' },
  // TODO: Phase 2 — { id: 'js', label: 'JS priority' }
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
