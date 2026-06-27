import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';

import { auth } from '@/lib/auth';
import {
  buildWeekGrid,
  dayParam,
  fetchCalendarEvents,
  getMonthGrid,
  monthBounds,
  monthParam,
  parseDayParam,
  parseMonthParam,
  shiftDay,
  shiftMonth,
  weekBounds,
} from '@/lib/calendar';

import { ListView } from './_components/ListView';
import { MonthView } from './_components/MonthView';
import { ViewTabs } from './_components/ViewTabs';
import { WeekView } from './_components/WeekView';

type PageProps = {
  searchParams?: { view?: string; date?: string };
};

export default async function CalendarPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const rawView = searchParams?.view;
  const view: 'month' | 'week' | 'list' =
    rawView === 'week' ? 'week' : rawView === 'list' ? 'list' : 'month';

  if (view === 'month') {
    return <MonthShell callerId={session.user.id} dateParam={searchParams?.date} />;
  }
  if (view === 'week') {
    return <WeekShell callerId={session.user.id} dateParam={searchParams?.date} />;
  }
  return <ListShell callerId={session.user.id} dateParam={searchParams?.date} />;
}

// ============================================================
// Month shell
// ============================================================

async function MonthShell({
  callerId,
  dateParam,
}: {
  callerId: string;
  dateParam?: string;
}) {
  const { year, monthIndex } = parseMonthParam(dateParam);
  const grid = getMonthGrid(year, monthIndex);
  const { from, to } = monthBounds(year, monthIndex);
  const events = await fetchCalendarEvents({ callerId, from, to });

  const prev = shiftMonth(year, monthIndex, -1);
  const next = shiftMonth(year, monthIndex, +1);
  const today = new Date();
  const isViewingThisMonth =
    today.getFullYear() === year && today.getMonth() === monthIndex;
  const monthLabel = format(new Date(year, monthIndex, 1), 'LLLL yyyy');
  const param = monthParam(year, monthIndex);

  return (
    <Frame view="month" date={param} title={monthLabel}>
      <NavStrip
        prevHref={`/calendar?view=month&date=${monthParam(prev.year, prev.monthIndex)}`}
        nextHref={`/calendar?view=month&date=${monthParam(next.year, next.monthIndex)}`}
        title={monthLabel}
        todayHref={isViewingThisMonth ? null : '/calendar?view=month'}
      />
      <Legend />
      <MonthView grid={grid} events={events} />
    </Frame>
  );
}

// ============================================================
// Week shell
// ============================================================

async function WeekShell({
  callerId,
  dateParam: rawDate,
}: {
  callerId: string;
  dateParam?: string;
}) {
  const { year, month, day } = parseDayParam(rawDate);
  const grid = buildWeekGrid(year, month, day);
  const { from, to } = weekBounds(grid);
  const events = await fetchCalendarEvents({ callerId, from, to });

  const prev = shiftDay(year, month, day, -7);
  const next = shiftDay(year, month, day, +7);
  const today = new Date();
  const todayParam = dayParam(today.getFullYear(), today.getMonth(), today.getDate());
  const currentParam = dayParam(year, month, day);
  const isViewingThisWeek = grid.some((d) => d.isToday);

  const weekLabel = `${format(grid[0].date, 'd MMM')} – ${format(grid[6].date, 'd MMM yyyy')}`;

  return (
    <Frame view="week" date={currentParam} title={weekLabel}>
      <NavStrip
        prevHref={`/calendar?view=week&date=${dayParam(prev.year, prev.month, prev.day)}`}
        nextHref={`/calendar?view=week&date=${dayParam(next.year, next.month, next.day)}`}
        title={weekLabel}
        todayHref={isViewingThisWeek ? null : `/calendar?view=week&date=${todayParam}`}
        prevLabel="Previous week"
        nextLabel="Next week"
      />
      <Legend />
      <WeekView grid={grid} events={events} />
    </Frame>
  );
}

// ============================================================
// List shell
// ============================================================

async function ListShell({
  callerId,
  dateParam,
}: {
  callerId: string;
  dateParam?: string;
}) {
  // List view: show 60 days starting from the chosen date (default: today)
  const start = parseListStart(dateParam);
  const from = new Date(start);
  from.setHours(0, 0, 0, 0);
  const to = new Date(start);
  to.setDate(start.getDate() + 60);
  to.setHours(23, 59, 59, 999);

  const events = await fetchCalendarEvents({ callerId, from, to });
  const title = `Next ${Math.round(
    (to.getTime() - from.getTime()) / 86_400_000,
  )} days`;

  return (
    <Frame view="list" date={undefined} title="Upcoming">
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[12px] text-ink-3">
          {title} · {events.length} {events.length === 1 ? 'event' : 'events'}
        </p>
        <Legend />
      </div>
      <ListView events={events} />
    </Frame>
  );
}

function parseListStart(raw: string | undefined): Date {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  return new Date();
}

// ============================================================
// Shared chrome
// ============================================================

function Frame({
  view,
  date,
  title,
  children,
}: {
  view: 'month' | 'week' | 'list';
  date: string | undefined;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-12">
      <header className="mb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-ink-3 font-medium mb-1 inline-flex items-center gap-1">
              <i
                className="ti ti-calendar text-[11px] text-primary"
                aria-hidden="true"
              />
              Milestones &amp; deadlines
            </p>
            <h1 className="font-serif text-[22px] md:text-[28px] leading-tight text-ink">
              {title}
            </h1>
            <p className="mt-1.5 text-[12px] text-ink-2 max-w-2xl leading-relaxed">
              Task milestones and Timeline File deadlines that you can see.
            </p>
          </div>
          <ViewTabs active={view} date={date} />
        </div>
      </header>
      {children}
    </div>
  );
}

function NavStrip({
  prevHref,
  nextHref,
  title,
  todayHref,
  prevLabel = 'Previous month',
  nextLabel = 'Next month',
}: {
  prevHref: string;
  nextHref: string;
  title: string;
  todayHref: string | null;
  prevLabel?: string;
  nextLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3 gap-3">
      <div className="inline-flex items-center gap-1">
        <Link
          href={prevHref}
          aria-label={prevLabel}
          className="w-8 h-8 grid place-items-center rounded-md text-ink-2 hover:bg-line-2 transition-colors"
        >
          <i className="ti ti-chevron-left text-[16px]" aria-hidden="true" />
        </Link>
        <span className="font-serif text-[16px] text-ink min-w-[140px] text-center">
          {title}
        </span>
        <Link
          href={nextHref}
          aria-label={nextLabel}
          className="w-8 h-8 grid place-items-center rounded-md text-ink-2 hover:bg-line-2 transition-colors"
        >
          <i className="ti ti-chevron-right text-[16px]" aria-hidden="true" />
        </Link>
      </div>
      {todayHref ? (
        <Link
          href={todayHref}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line text-[12px] font-medium text-ink-2 hover:bg-line-2 transition-colors"
        >
          <i className="ti ti-calendar-event text-[13px]" aria-hidden="true" />
          Today
        </Link>
      ) : null}
    </div>
  );
}

function Legend() {
  return (
    <div className="inline-flex items-center gap-3 text-[11px] text-ink-3 mb-3">
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm bg-primary-soft border border-primary-line/40" />
        Task milestone
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm bg-accent-soft border border-accent-line" />
        Timeline file
      </span>
    </div>
  );
}
