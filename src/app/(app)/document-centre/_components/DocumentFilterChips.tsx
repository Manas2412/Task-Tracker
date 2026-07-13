import Link from 'next/link';

import { DOC_FILTERS, DOC_FILTER_LABEL, type DocFilter } from '@/lib/document-centre-shared';
import { cn } from '@/lib/utils';

/**
 * Filter chip strip — Server Component. Each chip is a Link that updates
 * ?filter=, no client JS. Mirrors the tasks FilterChips.
 */
export function DocumentFilterChips({ active }: { active: DocFilter }) {
  return (
    <nav
      aria-label="Filter records"
      className="flex justify-start gap-1.5 overflow-x-auto md:overflow-visible md:flex-wrap snap-x snap-proximity [&::-webkit-scrollbar]:hidden -mx-1 px-1 py-1"
    >
      {DOC_FILTERS.map((id) => {
        const isActive = id === active;
        const href = id === 'all' ? '/document-centre' : `/document-centre?filter=${id}`;
        return (
          <Link
            key={id}
            href={href}
            scroll={false}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap px-[11px] py-[5px] rounded-[14px] text-[12px] font-medium border transition-colors snap-start',
              isActive
                ? 'bg-ink text-onink border-ink'
                : 'bg-panel text-ink-2 border-line hover:border-ink-4',
            )}
          >
            {DOC_FILTER_LABEL[id]}
          </Link>
        );
      })}
    </nav>
  );
}
