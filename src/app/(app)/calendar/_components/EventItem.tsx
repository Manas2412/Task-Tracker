'use client';

import Link from 'next/link';

import { cn } from '@/lib/utils';

import type { CalendarEvent } from '@/lib/calendar';
import { useCalendar } from './CalendarProvider';
import { KIND_META } from './kind-style';

/** Compact chip for the month + week grids. */
export function EventChip({ event }: { event: CalendarEvent }) {
  const meta = KIND_META[event.kind];
  const { openEngagementDetail } = useCalendar();

  const inner = (
    <>
      <i className={cn('ti text-[10px] shrink-0', meta.icon)} aria-hidden="true" />
      <span className="truncate">
        {event.time ? <span className="tabular-nums">{event.time} · </span> : null}
        {event.title}
      </span>
    </>
  );
  const base =
    'flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium truncate transition-colors';

  if (event.kind === 'engagement' && event.engagementId) {
    const id = event.engagementId;
    return (
      <button
        type="button"
        onClick={() => openEngagementDetail(id)}
        title={`${event.title}\n${event.sub}`}
        className={cn(base, meta.chip, 'w-full text-left')}
      >
        {inner}
      </button>
    );
  }
  return (
    <Link href={event.href ?? '#'} title={`${event.title}\n${event.sub}`} className={cn(base, meta.chip)}>
      {inner}
    </Link>
  );
}

/** Full-width row for the list view. */
export function EventRow({ event }: { event: CalendarEvent }) {
  const meta = KIND_META[event.kind];
  const { openEngagementDetail } = useCalendar();

  const inner = (
    <>
      <span className={cn('w-9 h-9 grid place-items-center rounded-lg shrink-0', meta.tile)}>
        <i className={cn('ti text-[16px]', meta.icon)} aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13.5px] font-medium text-ink truncate">
            {event.time ? <span className="text-ink-2 tabular-nums font-normal">{event.time}  </span> : null}
            {event.title}
          </p>
          <span className="text-[11px] text-ink-3 shrink-0">{meta.label}</span>
        </div>
        <p className="text-[11px] text-ink-3 mt-0.5 truncate">{event.sub}</p>
      </div>
    </>
  );
  const base = cn(
    'w-full flex items-start gap-3 p-3 rounded-xl border bg-panel transition-shadow hover:shadow-sm text-left',
    meta.rowBorder,
  );

  if (event.kind === 'engagement' && event.engagementId) {
    const id = event.engagementId;
    return (
      <button type="button" onClick={() => openEngagementDetail(id)} className={base}>
        {inner}
      </button>
    );
  }
  return (
    <Link href={event.href ?? '#'} className={base}>
      {inner}
    </Link>
  );
}
