import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { buildTfVisibilityClause } from '@/lib/timeline-files';

/**
 * Milestone Calendar — data fetch + grid helpers.
 *
 * "What appears" per PRD §5.4:
 *   - Tasks with the milestone toggle on
 *   - All Timeline File deadlines
 *
 * Both surfaces are visibility-scoped per the caller's permissions.
 */

export type CalendarEvent = {
  id: string;
  /** "task" → /tasks/[id]; "tf" → /timeline-files/[id] */
  kind: 'task' | 'tf';
  title: string;
  date: Date;
  href: string;
  /** Extra context shown on hover / in list view */
  sub: string;
  /** Optional priority for tasks; drives the colour dot */
  priority?: string;
};

// ============================================================
// Visibility builders (duplicated minimal version of the task scoper —
// the existing scoper doesn't take a date range and isn't worth refactoring
// just yet)
// ============================================================

type CallerSummary = {
  id: string;
  hierarchySlot: string;
  isSuperAdmin: boolean;
  divisionId: string;
};

async function buildTaskVisibilityForCalendar(
  me: CallerSummary,
): Promise<Prisma.TaskWhereInput[]> {
  // Same shape as src/lib/visibility.ts but inlined to avoid coupling.
  const clauses: Prisma.TaskWhereInput[] = [
    { ownerId: me.id },
    { collaborators: { some: { userId: me.id } } },
  ];
  if (me.isSuperAdmin || me.hierarchySlot === 'osd') {
    clauses.push({ visibility: 'division' });
    return clauses;
  }
  if (me.hierarchySlot === 'js') {
    clauses.push({
      visibility: 'division',
      jsPriorityLane: { not: null },
    });
    return clauses;
  }
  if (me.hierarchySlot === 'director') {
    clauses.push({ visibility: 'division', divisionId: me.divisionId });
    return clauses;
  }
  // Phase 1 simplification — own + direct reports' tasks
  const directReports = await prisma.user.findMany({
    where: { supervisorId: me.id },
    select: { id: true },
  });
  if (directReports.length > 0) {
    clauses.push({
      visibility: 'division',
      ownerId: { in: directReports.map((u) => u.id) },
    });
  }
  return clauses;
}

// ============================================================
// fetchCalendarEvents
// ============================================================

export async function fetchCalendarEvents(opts: {
  callerId: string;
  from: Date;
  to: Date;
}): Promise<CalendarEvent[]> {
  const me = await prisma.user.findUnique({
    where: { id: opts.callerId },
    select: {
      id: true,
      hierarchySlot: true,
      isSuperAdmin: true,
      divisionId: true,
    },
  });
  if (!me) return [];

  const taskVisibility = await buildTaskVisibilityForCalendar(me);
  const tfVisibility = await buildTfVisibilityClause(me);

  const [tasks, tfs] = await Promise.all([
    prisma.task.findMany({
      where: {
        archivedAt: null,
        parentTaskId: null,
        milestone: true,
        dueDate: { gte: opts.from, lte: opts.to },
        AND: [{ OR: taskVisibility }],
      },
      include: {
        owner: { include: { division: true } },
        division: true,
      },
    }),
    prisma.timelineFile.findMany({
      where: {
        archivedAt: null,
        deadlineDate: { gte: opts.from, lte: opts.to },
        AND: [tfVisibility],
      },
      select: {
        id: true,
        refNo: true,
        subject: true,
        deadlineDate: true,
        status: true,
        markedTo: {
          select: {
            division: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const events: CalendarEvent[] = [];

  for (const t of tasks) {
    if (!t.dueDate) continue;
    events.push({
      id: `task:${t.id}`,
      kind: 'task',
      title: t.name,
      date: t.dueDate,
      href: `/tasks/${t.id}`,
      sub: `${t.division.name} · ${t.owner.name}`,
      priority: t.priority,
    });
  }

  for (const tf of tfs) {
    if (!tf.deadlineDate) continue;
    const markedList =
      tf.markedTo.length > 0
        ? tf.markedTo.map((m) => m.division.name).join(', ')
        : 'no division';
    events.push({
      id: `tf:${tf.id}`,
      kind: 'tf',
      title: tf.subject,
      date: tf.deadlineDate,
      href: `/timeline-files/${tf.id}`,
      sub: `${tf.refNo} · ${markedList}`,
    });
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  return events;
}

// ============================================================
// Month grid (6 weeks × 7 days, week starts Monday)
// ============================================================

export type MonthDay = {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
};

export function getMonthGrid(year: number, monthIndex: number): MonthDay[] {
  // monthIndex is 0-based (0 = January, 11 = December)
  const firstOfMonth = new Date(year, monthIndex, 1);
  const weekday = firstOfMonth.getDay(); // 0 = Sun
  // Adjust for Monday start
  const offset = (weekday + 6) % 7;

  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(1 - offset);

  const todayIso = isoDay(new Date());

  const days: MonthDay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push({
      date: d,
      isCurrentMonth: d.getMonth() === monthIndex,
      isToday: isoDay(d) === todayIso,
    });
  }
  return days;
}

export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthBounds(year: number, monthIndex: number): { from: Date; to: Date } {
  // Inclusive bounds covering the full 6-week grid.
  const grid = getMonthGrid(year, monthIndex);
  const from = new Date(grid[0].date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(grid[grid.length - 1].date);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export function parseMonthParam(raw: string | undefined): { year: number; monthIndex: number } {
  // ?date=YYYY-MM
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split('-').map(Number);
    if (m >= 1 && m <= 12) return { year: y, monthIndex: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), monthIndex: now.getMonth() };
}

export function shiftMonth(year: number, monthIndex: number, delta: number): {
  year: number;
  monthIndex: number;
} {
  const d = new Date(year, monthIndex + delta, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

export function monthParam(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}
