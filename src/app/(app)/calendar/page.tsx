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
  type CalendarFilters as CalendarFiltersState,
} from '@/lib/calendar';
import { prisma } from '@/lib/db';
import { canAccessEngagements, getOfficeOfJsDivisionId } from '@/lib/engagements';
import { cn } from '@/lib/utils';

import { CalendarProvider } from './_components/CalendarProvider';
import { CalendarFilters } from './_components/CalendarFilters';
import { NewButton } from './_components/DateControls';
import {
  parseCalendarFilters,
  buildCalendarHref,
  toggleKindParam,
  type RawParams,
} from './_components/filter-params';
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
      events={events}
    >
      <MobileListDefault resolvedView={view} hasExplicitView={Boolean(sp.view)} />
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-12">
        <header className="mb-3 md:mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-serif text-[22px] md:text-[28px] leading-tight text-ink inline-flex items-center gap-2">
                <i className="ti ti-calendar text-[19px] md:text-[24px] text-primary" aria-hidden="true" />
                Planning calendar
              </h1>
              <p className="mt-1.5 text-[12px] text-ink-2 max-w-2xl leading-relaxed hidden sm:block">
                Engagements, task deadlines, and Timeline file deadlines you can see — in one view.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CalendarFilters sp={sp} filters={filters} divisions={divisions} />
              <NewButton />
            </div>
          </div>
        </header>

        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
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
            <div className="inline-flex items-baseline gap-2">
              <span className="font-serif text-[17px] md:text-[18px] text-ink">Upcoming</span>
              <span className="text-[12px] text-ink-3">
                {events.length} {events.length === 1 ? 'item' : 'items'} · next 60 days
              </span>
            </div>
          )}
          <ViewTabs active={view} sp={sp} />
        </div>

        <KindFilterBar sp={sp} filters={filters} showEngagements={canManageEngagements} />

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
    <div className="inline-flex items-center gap-1">
      <Link
        href={prevHref}
        scroll={false}
        aria-label={prevLabel}
        className="w-9 h-9 grid place-items-center rounded-md text-ink-2 hover:bg-line-2 transition-colors"
      >
        <i className="ti ti-chevron-left text-[18px]" aria-hidden="true" />
      </Link>
      <span className="font-serif text-[17px] md:text-[18px] text-ink min-w-[132px] md:min-w-[150px] text-center">
        {title}
      </span>
      <Link
        href={nextHref}
        scroll={false}
        aria-label={nextLabel}
        className="w-9 h-9 grid place-items-center rounded-md text-ink-2 hover:bg-line-2 transition-colors"
      >
        <i className="ti ti-chevron-right text-[18px]" aria-hidden="true" />
      </Link>
      {todayHref ? (
        <Link
          href={todayHref}
          scroll={false}
          className="ml-1 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line text-[12px] font-medium text-ink-2 hover:bg-line-2 transition-colors"
        >
          <i className="ti ti-calendar-event text-[13px]" aria-hidden="true" />
          <span className="hidden sm:inline">Today</span>
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Kind filter buttons — the calendar's legend doubles as its item-type filter.
 * Each button toggles its kind in the `?types=` param (server-rendered, no
 * client JS); the active state glows in that kind's hue. Replaces the static
 * legend and the old "Show" section inside the Filters sheet.
 */
function KindFilterBar({
  sp,
  filters,
  showEngagements,
}: {
  sp: RawParams;
  filters: CalendarFiltersState;
  showEngagements: boolean;
}) {
  const kinds = KIND_ORDER.filter((k) => k !== 'engagement' || showEngagements);
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      {kinds.map((k) => {
        const meta = KIND_META[k];
        const active = filters.kinds.has(k);
        return (
          <Link
            key={k}
            href={buildCalendarHref(sp, { types: toggleKindParam(filters.kinds, k, kinds) })}
            scroll={false}
            aria-label={active ? `Hide ${meta.label}` : `Show ${meta.label}`}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all',
              active
                ? meta.activeBtn
                : 'border-line bg-panel text-ink-3 hover:text-ink-2 hover:border-ink-4',
            )}
          >
            <span
              className={cn('w-2.5 h-2.5 rounded-full transition-colors', active ? meta.dot : 'bg-ink-4/40')}
              aria-hidden="true"
            />
            {meta.label}
          </Link>
        );
      })}
    </div>
  );
}
