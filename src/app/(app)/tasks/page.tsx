import { Suspense } from 'react';
import { redirect } from 'next/navigation';

import { PullToRefresh } from '@/components/ui';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatDue, initialsOf } from '@/lib/format';
import { fetchTaskCounts, fetchVisibleTasks, type TaskFilter, type TaskSort } from '@/lib/visibility';

import { DivisionControls } from './_components/DivisionControls';
import { FilterChips } from './_components/FilterChips';
import { StatsStrip } from './_components/StatsStrip';
import { TaskListItem } from './_components/TaskListItem';
import { QuickCreatePrimary } from './_components/QuickCreate';

import type { PillJsLane, PillPriorityTone, PillStatusTone } from '@/components/ui/Pill';

const VALID_FILTERS: TaskFilter[] = ['all', 'today', 'overdue', 'mine', 'urgent', 'completed', 'js_priority', 'milestone'];

type PageProps = {
  searchParams?: { filter?: string; division?: string; group?: string; sort?: string };
};

export default async function TasksPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const filter: TaskFilter = VALID_FILTERS.includes(
    (searchParams?.filter as TaskFilter) ?? 'all',
  )
    ? ((searchParams?.filter as TaskFilter) ?? 'all')
    : 'all';

  const divisionFilter = searchParams?.division ?? '';
  const groupByDivision = searchParams?.group === 'division';
  const sort: TaskSort = searchParams?.sort === 'latest' ? 'latest' : 'default';

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      divisionId: true,
      isSuperAdmin: true,
      hierarchySlot: true,
      isPmu: true,
    },
  });
  if (!me) redirect('/login');

  const isAdminLike = me.isSuperAdmin || me.hierarchySlot === 'osd';

  const [taskResult, counts, divisions] = await Promise.all([
    fetchVisibleTasks({ callerId: me.id, filter, divisionId: divisionFilter || undefined, sort }),
    fetchTaskCounts(me.id),
    prisma.division.findMany({
      where: { kind: 'division' },
      select: { id: true, name: true },
      orderBy: { displayOrder: 'asc' },
    }),
  ]);

  const { tasks, total, capped } = taskResult;

  const grouped = groupByDivision ? groupTasksByDivision(tasks) : null;
  const segments = groupByDivision ? null : segmentTasksByRelation(tasks, me.id, me.isPmu);

  return (
      <PullToRefresh>
      <div className="pb-24 md:pb-10">
        {/* Page header */}
        <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6">
          <div className="flex items-end justify-between gap-4 mb-4 md:mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.08em] text-ink-3 font-medium mb-1">
                Workspace
              </p>
              <h1 className="font-serif text-[22px] md:text-[26px] leading-tight text-ink">
                Active tasks
              </h1>
            </div>
            <div className="hidden md:block">
              <QuickCreatePrimary />
            </div>
          </div>

          <FilterChips active={filter} />
          <Suspense fallback={null}>
            <DivisionControls divisions={divisions} />
          </Suspense>
          <StatsStrip counts={counts} />
        </div>

        {/* Task list */}
        <div className="px-4 md:px-6 lg:px-8 mt-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="section-label">Tasks</h2>
            <span className="text-[11px] text-ink-3">
              {capped ? `Showing ${tasks.length} of ${total}` : `${tasks.length} ${tasks.length === 1 ? 'item' : 'items'}`}
            </span>
          </div>

          {grouped ? (
            grouped.length === 0 ? (
              <EmptyState filter={filter} />
            ) : (
              <div className="space-y-6">
                {grouped.map((group) => (
                  <section key={group.divisionId}>
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: group.colour }}
                      />
                      <h3 className="text-[12px] font-medium text-ink-2 uppercase tracking-[0.06em]">
                        {group.divisionName}
                      </h3>
                      <span className="text-[11px] text-ink-3">
                        {group.tasks.length}
                      </span>
                    </div>
                    <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3">
                      {group.tasks.map((t) => (
                        <TaskRow key={t.id} task={t} meId={me.id} isAdminLike={isAdminLike} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )
          ) : (
            // Always render all three segments — even empty ones — so the
            // three-part structure is visible on every login.
            <div className="space-y-6">
              {segments!.map((segment) => (
                <section key={segment.key} aria-label={segment.label}>
                  <div className="flex items-center gap-2 mb-2">
                    <i
                      className={`ti ${segment.icon} text-[14px] text-ink-3`}
                      aria-hidden="true"
                    />
                    <h3 className="text-[12px] font-medium text-ink-2 uppercase tracking-[0.06em]">
                      {segment.label}
                    </h3>
                    <span className="text-[11px] text-ink-3">
                      {segment.tasks.length}
                    </span>
                    {segment.subtitle ? (
                      <span className="text-[11px] text-ink-3 normal-case tracking-normal font-normal">
                        · {segment.subtitle}
                      </span>
                    ) : null}
                  </div>
                  {segment.tasks.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-line bg-panel px-3 py-3 text-[12px] text-ink-3">
                      {segment.emptyLabel}
                    </p>
                  ) : (
                    <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3">
                      {segment.tasks.map((t) => (
                        <TaskRow key={t.id} task={t} meId={me.id} isAdminLike={isAdminLike} />
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>

      </div>
      </PullToRefresh>
  );
}

type VisibleTask = Awaited<ReturnType<typeof fetchVisibleTasks>>['tasks'][number];

function TaskRow({
  task: t,
  meId,
  isAdminLike,
}: {
  task: VisibleTask;
  meId: string;
  isAdminLike: boolean;
}) {
  const subtaskTotal = t.subtasks.length;
  const subtaskDone = t.subtasks.filter((s) => s.status === 'completed').length;
  const due = formatDue(t.dueDate);
  const canArchive = t.ownerId === meId || t.createdById === meId || isAdminLike;

  return (
    <li>
      <TaskListItem
        canArchive={canArchive}
        taskId={t.id}
        refNumber={t.refNumber}
        name={t.name}
        division={{ name: t.division.name }}
        status={t.status as PillStatusTone}
        priority={t.priority as PillPriorityTone}
        jsPriorityLane={t.jsPriorityLane as PillJsLane | null}
        milestone={t.milestone}
        due={due}
        owner={{
          initials: initialsOf(t.owner.name),
          colour: t.owner.division.avatarColour,
          name: t.owner.name,
        }}
        subtasks={subtaskTotal > 0 ? { done: subtaskDone, total: subtaskTotal } : undefined}
        hasAttachment={t.hasAttachment}
        primaryDivisionName={
          t.collaborators.some((c) => c.role === 'division_lead')
            ? t.division.name
            : undefined
        }
        href={`/tasks/${t.id}`}
      />
    </li>
  );
}

/**
 * The three segments of the tasks view, in display order:
 *   1. Tasks assigned to me — division tasks I currently own (includes any
 *                             task transferred or handed to me)
 *   2. Other tasks of my division — the rest of the division's tasks (or,
 *                             for a PMU member, the rest of their PMU team's)
 *   3. Personal tasks — my personal-visibility tasks, visible to me only
 * Every visible task falls in exactly one segment (personal vs division,
 * division split by ownership). All three segments are always shown, even
 * when empty, so the structure is consistent on every login.
 */
type RelationSegment = {
  key: 'assigned' | 'others' | 'personal';
  label: string;
  subtitle?: string;
  emptyLabel: string;
  icon: string;
  tasks: VisibleTask[];
};

function segmentTasksByRelation(
  tasks: VisibleTask[],
  meId: string,
  isPmu: boolean,
): RelationSegment[] {
  const personal = tasks.filter((t) => t.visibility === 'personal');
  const assigned = tasks.filter((t) => t.visibility === 'division' && t.ownerId === meId);
  const others = tasks.filter((t) => t.visibility === 'division' && t.ownerId !== meId);

  return [
    {
      key: 'assigned',
      label: 'Tasks assigned to me',
      emptyLabel: 'No tasks are assigned to you.',
      icon: 'ti-user-check',
      tasks: assigned,
    },
    {
      key: 'others',
      label: isPmu ? 'Other tasks of my PMU team' : 'Other tasks of my division',
      emptyLabel: isPmu
        ? 'No other tasks in your PMU team.'
        : 'No other tasks in your division.',
      icon: 'ti-building',
      tasks: others,
    },
    {
      key: 'personal',
      label: 'Personal tasks',
      subtitle: 'Visible to me only',
      emptyLabel: 'You have not created any personal tasks.',
      icon: 'ti-lock',
      tasks: personal,
    },
  ];
}

type DivisionGroup = {
  divisionId: string;
  divisionName: string;
  colour: string;
  tasks: VisibleTask[];
};

function groupTasksByDivision(tasks: VisibleTask[]): DivisionGroup[] {
  const map = new Map<string, DivisionGroup>();
  for (const t of tasks) {
    let group = map.get(t.divisionId);
    if (!group) {
      group = {
        divisionId: t.divisionId,
        divisionName: t.division.name,
        colour: t.division.avatarColour,
        tasks: [],
      };
      map.set(t.divisionId, group);
    }
    group.tasks.push(t);
  }
  return Array.from(map.values());
}

function EmptyState({ filter }: { filter: TaskFilter }) {
  const copy: Record<TaskFilter, string> = {
    all: 'No tasks yet. Use the + button or "New task" to create one.',
    today: 'Nothing due today.',
    overdue: 'No overdue tasks. Stay on top.',
    mine: 'No tasks owned by you in this view.',
    urgent: 'No urgent tasks right now.',
    js_priority: 'No JS Priority tasks.',
    milestone: 'No milestone tasks.',
    completed: 'No completed tasks.',
  };
  return (
    <div className="rounded-xl border border-dashed border-line p-10 text-center bg-panel">
      <i className="ti ti-inbox text-[28px] text-ink-3 mb-2 block" aria-hidden="true" />
      <p className="text-[13px] text-ink-2">{copy[filter]}</p>
    </div>
  );
}
