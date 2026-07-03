import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';

import {
  markAllNotificationsReadAction,
  readAndRedirectAction,
} from '@/app/actions/notifications';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatDue } from '@/lib/format';
import { describeNotification } from '@/lib/notifications';
import { cn } from '@/lib/utils';

import { NotificationRowSwipe } from './_components/NotificationRowSwipe';

type Filter = 'all' | 'unread';

type PageProps = {
  searchParams?: { filter?: string };
};

export default async function NotificationsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const filter: Filter = searchParams?.filter === 'unread' ? 'unread' : 'all';

  const [notifications, totalCount, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: session.user.id,
        ...(filter === 'unread' ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.notification.count({ where: { userId: session.user.id } }),
    prisma.notification.count({
      where: { userId: session.user.id, readAt: null },
    }),
  ]);

  const assignmentDetails = await buildAssignmentDetails(notifications);

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-ink-3 font-medium mb-1">
            Inbox
          </p>
          <h1 className="font-serif text-[22px] md:text-[26px] leading-tight text-ink">
            Notifications
          </h1>
          <p className="text-[12px] text-ink-3 mt-1">
            {totalCount} total ·{' '}
            <span className={cn(unreadCount > 0 && 'text-urgent font-medium')}>
              {unreadCount} unread
            </span>
          </p>
        </div>
        {unreadCount > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line text-[12px] font-medium text-ink hover:bg-line-2"
            >
              <i className="ti ti-checks text-[14px]" aria-hidden="true" />
              Mark all read
            </button>
          </form>
        ) : null}
      </header>

      <nav aria-label="Filter notifications" className="flex gap-1.5 mb-4">
        <FilterChip id="all" label={`All (${totalCount})`} active={filter === 'all'} />
        <FilterChip
          id="unread"
          label={`Unread (${unreadCount})`}
          active={filter === 'unread'}
        />
      </nav>

      {notifications.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <ul className="bg-panel border border-line rounded-xl overflow-hidden">
          {notifications.map((n) => (
            <Row key={n.id} notification={n} assignment={assignmentDetails.get(n.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Row
// ------------------------------------------------------------

function Row({
  notification,
  assignment,
}: {
  notification: {
    id: string;
    type: string;
    payload: unknown;
    readAt: Date | null;
    createdAt: Date;
  };
  assignment?: AssignmentDetails;
}) {
  const described = describeNotification(
    notification.type,
    notification.payload as Record<string, unknown> | null,
  );
  const isUnread = !notification.readAt;

  return (
    <li className="border-b border-line-2 last:border-b-0">
      <NotificationRowSwipe notificationId={notification.id} unread={isUnread}>
      <form action={readAndRedirectAction}>
        <input type="hidden" name="id" value={notification.id} />
        <input type="hidden" name="href" value={described.href} />
        <button
          type="submit"
          className={cn(
            'w-full flex items-start gap-3 px-4 md:px-5 py-3.5 text-left hover:bg-bg transition-colors relative',
            isUnread && accentBg(described.accent),
          )}
        >
          {isUnread ? (
            <span
              aria-hidden="true"
              className={cn(
                'absolute left-0 top-3 bottom-3 w-[3px] rounded-r',
                accentLine(described.accent),
              )}
            />
          ) : null}

          <span
            className={cn(
              'w-9 h-9 grid place-items-center rounded-lg shrink-0',
              isUnread ? 'bg-panel' : 'bg-line-2',
            )}
          >
            <i
              className={cn('ti', described.icon, 'text-[16px]', described.iconClass)}
              aria-hidden="true"
            />
          </span>

          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'text-[13px] leading-snug',
                isUnread ? 'text-ink font-medium' : 'text-ink-2',
              )}
            >
              {described.text}
            </p>
            {assignment ? <AssignmentCard assignment={assignment} /> : null}
            <time
              className="text-[11px] text-ink-3 mt-0.5 block"
              dateTime={notification.createdAt.toISOString()}
              title={format(notification.createdAt, 'd LLL yyyy, h:mm a')}
            >
              {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
            </time>
          </div>

          {isUnread ? (
            <span
              aria-hidden="true"
              className="w-2 h-2 rounded-full bg-urgent mt-1.5 shrink-0"
            />
          ) : (
            <i
              className="ti ti-chevron-right text-[14px] text-ink-4 shrink-0 mt-1"
              aria-hidden="true"
            />
          )}
        </button>
      </form>
      </NotificationRowSwipe>
    </li>
  );
}

// ------------------------------------------------------------
// Task-assignment card — task name, assigned by, due date
// ------------------------------------------------------------

type AssignmentDetails = {
  taskName: string;
  assignedByName: string | null;
  dueDate: Date | null;
};

function AssignmentCard({ assignment }: { assignment: AssignmentDetails }) {
  const due = assignment.dueDate ? formatDue(assignment.dueDate) : null;

  return (
    <span className="block mt-2 mb-1 rounded-lg border border-line bg-bg px-3 py-2.5">
      <span className="block text-[13px] font-medium text-ink leading-snug">
        {assignment.taskName}
      </span>
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
        {assignment.assignedByName ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-3">
            <i className="ti ti-user text-[12px]" aria-hidden="true" />
            Assigned by <span className="font-medium text-ink-2">{assignment.assignedByName}</span>
          </span>
        ) : null}
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-[11px]',
            due?.tone === 'overdue' && 'text-urgent font-medium',
            due?.tone === 'today' && 'text-accent font-medium',
            (!due || due.tone === 'soon' || due.tone === 'future') && 'text-ink-3',
          )}
        >
          <i className="ti ti-calendar-due text-[12px]" aria-hidden="true" />
          {assignment.dueDate
            ? `Due ${format(assignment.dueDate, 'd LLL yyyy, h:mm aaa')}`
            : 'No due date'}
        </span>
      </span>
    </span>
  );
}

const UUID_RE = /^[0-9a-f-]{36}$/i;

/**
 * Resolves the card content for every task-assignment notification in one
 * batched pass. Live task data (name, due date) wins so the card stays
 * accurate after edits; the payload snapshot covers deleted tasks and
 * notifications created before the payload carried these fields.
 */
async function buildAssignmentDetails(
  notifications: { id: string; type: string; payload: unknown }[],
): Promise<Map<string, AssignmentDetails>> {
  const details = new Map<string, AssignmentDetails>();
  const rows = notifications
    .filter((n) => n.type === 'task_assigned')
    .map((n) => ({ id: n.id, payload: (n.payload ?? {}) as Record<string, unknown> }));
  if (rows.length === 0) return details;

  const taskIds = new Set<string>();
  const assignerIds = new Set<string>();
  for (const { payload } of rows) {
    if (typeof payload.taskId === 'string' && UUID_RE.test(payload.taskId)) {
      taskIds.add(payload.taskId);
    }
    // Older notifications carry only an actor id — resolve the name live.
    const assignerId = payload.assignedById ?? payload.actorId;
    if (
      typeof payload.assignedByName !== 'string' &&
      typeof assignerId === 'string' &&
      UUID_RE.test(assignerId)
    ) {
      assignerIds.add(assignerId);
    }
  }

  const [tasks, assigners] = await Promise.all([
    taskIds.size > 0
      ? prisma.task.findMany({
          where: { id: { in: [...taskIds] } },
          select: { id: true, name: true, dueDate: true },
        })
      : Promise.resolve([]),
    assignerIds.size > 0
      ? prisma.user.findMany({
          where: { id: { in: [...assignerIds] } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const nameById = new Map(assigners.map((u) => [u.id, u.name]));

  for (const { id, payload } of rows) {
    const task = typeof payload.taskId === 'string' ? taskById.get(payload.taskId) : undefined;
    const taskName =
      task?.name ??
      (typeof payload.taskName === 'string' && payload.taskName.trim()
        ? payload.taskName.trim()
        : null);
    if (!taskName) continue;

    const assignerId = payload.assignedById ?? payload.actorId;
    const assignedByName =
      typeof payload.assignedByName === 'string' && payload.assignedByName.trim()
        ? payload.assignedByName.trim()
        : typeof assignerId === 'string'
          ? nameById.get(assignerId) ?? null
          : null;

    // When the task still exists its due date wins — even if null (cleared).
    const dueDate = task
      ? task.dueDate
      : typeof payload.dueDate === 'string' && !Number.isNaN(Date.parse(payload.dueDate))
        ? new Date(payload.dueDate)
        : null;

    details.set(id, { taskName, assignedByName, dueDate });
  }
  return details;
}

// ------------------------------------------------------------
// Filter chip + empty state
// ------------------------------------------------------------

function FilterChip({
  id,
  label,
  active,
}: {
  id: Filter;
  label: string;
  active: boolean;
}) {
  const href = id === 'all' ? '/notifications' : `/notifications?filter=${id}`;
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'whitespace-nowrap px-3 py-1.5 rounded-[14px] text-[12px] font-medium border transition-colors',
        active
          ? 'bg-ink text-white border-ink'
          : 'bg-panel text-ink-2 border-line hover:border-ink-4',
      )}
    >
      {label}
    </Link>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-panel p-12 text-center">
      <i className="ti ti-bell-off text-[32px] text-ink-3 block mb-2" aria-hidden="true" />
      <h2 className="font-serif text-[18px] text-ink mb-1">
        {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
      </h2>
      <p className="text-[13px] text-ink-2 max-w-md mx-auto leading-relaxed">
        {filter === 'unread'
          ? 'You are all caught up.'
          : 'When something happens on a task you care about, you will see it here.'}
      </p>
    </div>
  );
}

// ------------------------------------------------------------
// Tone helpers (duplicated from NotificationsBell to keep the page server-only)
// ------------------------------------------------------------

function accentBg(accent: ReturnType<typeof describeNotification>['accent']) {
  switch (accent) {
    case 'js':
      return 'bg-accent-soft/40';
    case 'urgent':
      return 'bg-urgent-soft/40';
    case 'primary':
      return 'bg-primary-soft/50';
    case 'info':
      return 'bg-info-soft/30';
    default:
      return 'bg-bg/50';
  }
}

function accentLine(accent: ReturnType<typeof describeNotification>['accent']) {
  switch (accent) {
    case 'js':
      return 'bg-accent';
    case 'urgent':
      return 'bg-urgent';
    case 'primary':
      return 'bg-primary';
    case 'info':
      return 'bg-info';
    default:
      return 'bg-ink-4';
  }
}
