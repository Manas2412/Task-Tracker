import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
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
  type CalendarEvent,
} from '@/lib/calendar';
import { prisma } from '@/lib/db';
import { canAccessEngagements, getOfficeOfJsDivisionId } from '@/lib/engagements';

import { CalendarProvider } from './_components/CalendarProvider';
import { NewButton } from './_components/DateControls';
import { FilterBar } from './_components/FilterBar';
import { parseCalendarFilters, buildCalendarHref, type RawParams } from './_components/filter-params';
import { KIND_META, KIND_ORDER } from './_components/kind-style';
import { ListView } from './_components/ListView';
import { MobileListDefault } from './_components/MobileListDefault';
import { MonthView } from './_components/MonthView';
import { ViewTabs } from './_components/ViewTabs';
import { WeekView } from './_components/WeekView';
import type { PickUser } from './_components/types';

type PageProps = {
  searchParams?: RawParams;
};

export default async function CalendarPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const sp: RawParams = searchParams ?? {};
  // Mobile devices default to the list view (the month/week grids are
  // desktop-oriented); an explicit ?view= always wins. A client fallback
  // (MobileListDefault) also catches narrow viewports the UA can't see.
  const ua = headers().get('user-agent') ?? '';
  const isMobileUA = /iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini|Windows Phone/i.test(ua);
  const view: 'month' | 'week' | 'list' =
    sp.view === 'week'
      ? 'week'
      : sp.view === 'list'
        ? 'list'
        : sp.view === 'month'
          ? 'month'
          : isMobileUA
            ? 'list'
            : 'month';
  const filters = parseCalendarFilters(sp);

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, divisionId: true, isSuperAdmin: true, hierarchySlot: true },
  });
  if (!me) redirect('/login');

  const officeOfJsDivisionId = await getOfficeOfJsDivisionId();
  const canManageEngagements = canAccessEngagements(me, officeOfJsDivisionId);
  const canCreateTf = me.isSuperAdmin || me.hierarchySlot === 'osd';
  // Only cross-division viewers get a division filter; everyone else is
  // already scoped to their own division by the visibility rules.
  const canFilterByDivision = me.isSuperAdmin || me.hierarchySlot === 'osd';

  // Per-view window + navigation.
  const win = resolveWindow(view, sp.date);

  const [events, divisions, candidates] = await Promise.all([
    fetchCalendarEvents({ callerId: me.id, from: win.from, to: win.to, filters }),
    canFilterByDivision
      ? prisma.division.findMany({
          where: { kind: 'division' },
          select: { id: true, name: true },
          orderBy: { displayOrder: 'asc' },
        })
      : Promise.resolve<{ id: string; name: string }[]>([]),
    canManageEngagements
      ? prisma.user.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            designation: true,
            division: { select: { name: true } },
          },
          orderBy: { name: 'asc' },
          take: 400,
        })
      : Promise.resolve([]),
  ]);

  const participantCandidates: PickUser[] = candidates.map((u) => ({
    id: u.id,
    name: u.name,
    designation: u.designation,
    divisionName: u.division.name,
  }));

  return (
    <CalendarProvider
      canManageEngagements={canManageEngagements}
      canCreateTf={canCreateTf}
      participantCandidates={participantCandidates}
    >
      <MobileListDefault resolvedView={view} hasExplicitView={Boolean(sp.view)} />
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-12">
        <header className="mb-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.08em] text-ink-3 font-medium mb-1 inline-flex items-center gap-1">
                <i className="ti ti-calendar text-[11px] text-primary" aria-hidden="true" />
                Planning calendar
              </p>
              <h1 className="font-serif text-[22px] md:text-[28px] leading-tight text-ink">
                {win.title}
              </h1>
              <p className="mt-1.5 text-[12px] text-ink-2 max-w-2xl leading-relaxed">
                Engagements, task deadlines, and Timeline file deadlines you can see — in one view.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ViewTabs active={view} sp={sp} />
              <NewButton />
            </div>
          </div>
        </header>

        <FilterBar
          sp={sp}
          filters={filters}
          showEngagements={canManageEngagements}
          divisions={divisions}
        />

        {view !== 'list' ? (
          <NavStrip
            prevHref={buildCalendarHref(sp, { date: win.prevDate })}
            nextHref={buildCalendarHref(sp, { date: win.nextDate })}
            title={win.navTitle}
            todayHref={win.isCurrent ? null : buildCalendarHref(sp, { date: null })}
            prevLabel={view === 'week' ? 'Previous week' : 'Previous month'}
            nextLabel={view === 'week' ? 'Next week' : 'Next month'}
          />
        ) : (
          <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[12px] text-ink-3">
              {events.length} {events.length === 1 ? 'item' : 'items'} in the next 60 days
            </p>
          </div>
        )}

        <Legend showEngagements={canManageEngagements} />

        {view === 'month' ? (
          <MonthView grid={win.monthGrid!} events={events} />
        ) : view === 'week' ? (
          <WeekView grid={win.weekGrid!} events={events} />
        ) : (
          <ListView events={events} />
        )}
      </div>
    </CalendarProvider>
  );
}

// ============================================================
// Per-view window resolution
// ============================================================

type Window = {
  from: Date;
  to: Date;
  title: string;
  navTitle: string;
  prevDate: string;
  nextDate: string;
  isCurrent: boolean;
  monthGrid?: ReturnType<typeof getMonthGrid>;
  weekGrid?: ReturnType<typeof buildWeekGrid>;
};

function resolveWindow(view: 'month' | 'week' | 'list', dateParam: string | undefined): Window {
  if (view === 'week') {
    const { year, month, day } = parseDayParam(dateParam);
    const grid = buildWeekGrid(year, month, day);
    const { from, to } = weekBounds(grid);
    const prev = shiftDay(year, month, day, -7);
    const next = shiftDay(year, month, day, +7);
    const label = `${format(grid[0].date, 'd MMM')} – ${format(grid[6].date, 'd MMM yyyy')}`;
    return {
      from,
      to,
      title: label,
      navTitle: label,
      prevDate: dayParam(prev.year, prev.month, prev.day),
      nextDate: dayParam(next.year, next.month, next.day),
      isCurrent: grid.some((d) => d.isToday),
      weekGrid: grid,
    };
  }

  if (view === 'list') {
    const start = parseListStart(dateParam);
    const from = new Date(start);
    from.setHours(0, 0, 0, 0);
    const to = new Date(start);
    to.setDate(start.getDate() + 60);
    to.setHours(23, 59, 59, 999);
    return {
      from,
      to,
      title: 'Upcoming',
      navTitle: 'Upcoming',
      prevDate: '',
      nextDate: '',
      isCurrent: true,
    };
  }

  // month
  const { year, monthIndex } = parseMonthParam(dateParam);
  const grid = getMonthGrid(year, monthIndex);
  const { from, to } = monthBounds(year, monthIndex);
  const prev = shiftMonth(year, monthIndex, -1);
  const next = shiftMonth(year, monthIndex, +1);
  const today = new Date();
  const label = format(new Date(year, monthIndex, 1), 'LLLL yyyy');
  return {
    from,
    to,
    title: label,
    navTitle: label,
    prevDate: monthParam(prev.year, prev.monthIndex),
    nextDate: monthParam(next.year, next.monthIndex),
    isCurrent: today.getFullYear() === year && today.getMonth() === monthIndex,
    monthGrid: grid,
  };
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
// Chrome
// ============================================================

function NavStrip({
  prevHref,
  nextHref,
  title,
  todayHref,
  prevLabel,
  nextLabel,
}: {
  prevHref: string;
  nextHref: string;
  title: string;
  todayHref: string | null;
  prevLabel: string;
  nextLabel: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3 gap-3">
      <div className="inline-flex items-center gap-1">
        <Link
          href={prevHref}
          scroll={false}
          aria-label={prevLabel}
          className="w-8 h-8 grid place-items-center rounded-md text-ink-2 hover:bg-line-2 transition-colors"
        >
          <i className="ti ti-chevron-left text-[16px]" aria-hidden="true" />
        </Link>
        <span className="font-serif text-[16px] text-ink min-w-[140px] text-center">{title}</span>
        <Link
          href={nextHref}
          scroll={false}
          aria-label={nextLabel}
          className="w-8 h-8 grid place-items-center rounded-md text-ink-2 hover:bg-line-2 transition-colors"
        >
          <i className="ti ti-chevron-right text-[16px]" aria-hidden="true" />
        </Link>
      </div>
      {todayHref ? (
        <Link
          href={todayHref}
          scroll={false}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line text-[12px] font-medium text-ink-2 hover:bg-line-2 transition-colors"
        >
          <i className="ti ti-calendar-event text-[13px]" aria-hidden="true" />
          Today
        </Link>
      ) : null}
    </div>
  );
}

function Legend({ showEngagements }: { showEngagements: boolean }) {
  const kinds = KIND_ORDER.filter((k) => k !== 'engagement' || showEngagements);
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-3 mb-3">
      {kinds.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${KIND_META[k].dot}`} />
          {KIND_META[k].label}
        </span>
      ))}
    </div>
  );
}
