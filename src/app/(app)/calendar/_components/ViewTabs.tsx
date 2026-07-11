import Link from 'next/link';

import { cn } from '@/lib/utils';

import { buildCalendarHref, type RawParams } from './filter-params';

type ViewTabsProps = {
  active: 'month' | 'week' | 'list';
  /** Current search params, so filters (and date) survive the switch. */
  sp: RawParams;
};

const TABS = [
  { value: 'month' as const, label: 'Month', icon: 'ti-calendar-month' },
  { value: 'week' as const, label: 'Week', icon: 'ti-calendar-event' },
  { value: 'list' as const, label: 'List', icon: 'ti-list-details' },
];

export function ViewTabs({ active, sp }: ViewTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Calendar view"
      className="inline-flex items-center gap-0.5 p-[3px] bg-bg border border-line rounded-lg"
    >
      {TABS.map((t) => {
        const isActive = t.value === active;
        return (
          <Link
            key={t.value}
            href={buildCalendarHref(sp, { view: t.value })}
            scroll={false}
            role="tab"
            aria-selected={isActive}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors',
              isActive ? 'bg-ink text-onink' : 'text-ink-2 hover:text-ink hover:bg-line-2',
            )}
          >
            <i className={cn('ti', t.icon, 'text-[13px]')} aria-hidden="true" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
