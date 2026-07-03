import { prisma } from '@/lib/db';

/**
 * Resolves the task context (title, division, due date, acting user) shown
 * under every task-linked notification — in the bell dropdown and on the
 * /notifications page alike. One batched pass, server-only (queries the DB).
 */

const UUID_RE = /^[0-9a-f-]{36}$/i;

export type NotificationTaskContext = {
  taskName: string;
  divisionName: string | null;
  dueDate: Date | null;
  actorLabel: string | null;
  actorName: string | null;
};

/**
 * Per-type label for the "who did this" line. Notification types not
 * listed here have no natural actor (task_due_soon / task_overdue are
 * system-generated; js_priority_added has no actor tracked) — no line
 * renders for those.
 */
const ACTOR_LABEL: Record<string, string> = {
  task_assigned: 'Assigned by',
  task_transferred: 'Transferred by',
  task_pulled: 'Pulled by',
  status_changed_on_my_task: 'Changed by',
  cross_division_status_change: 'Changed by',
  mention: 'Mentioned by',
  reassignment_approval_requested: 'Requested by',
  reassignment_approved: 'Approved by',
  reassignment_rejected: 'Rejected by',
  js_priority_added: 'Added by',
};

/** Payload keys that may already carry the actor's resolved display name. */
const ACTOR_NAME_KEYS = ['assignedByName', 'actorName', 'fromName', 'pulledByName'] as const;
/** Payload keys that may carry only the actor's user id, checked in order. */
const ACTOR_ID_KEYS = ['assignedById', 'actorId'] as const;

/**
 * Resolves task title, division, due date, and (where the type has one)
 * the acting user's name for every task-linked notification in one
 * batched pass. Live task/user data wins over the payload snapshot so
 * renamed tasks, changed due dates, and reassigned divisions stay
 * accurate; the snapshot covers deleted tasks and notifications created
 * before their payload carried these fields.
 */
export async function buildNotificationTaskContext(
  notifications: { id: string; type: string; payload: unknown }[],
): Promise<Map<string, NotificationTaskContext>> {
  const context = new Map<string, NotificationTaskContext>();

  const rows = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    payload: (n.payload ?? {}) as Record<string, unknown>,
  }));

  const taskIds = new Set<string>();
  const actorIds = new Set<string>();
  for (const { payload } of rows) {
    if (typeof payload.taskId === 'string' && UUID_RE.test(payload.taskId)) {
      taskIds.add(payload.taskId);
    }
    const hasName = ACTOR_NAME_KEYS.some(
      (k) => typeof payload[k] === 'string' && (payload[k] as string).trim().length > 0,
    );
    if (!hasName) {
      for (const key of ACTOR_ID_KEYS) {
        const id = payload[key];
        if (typeof id === 'string' && UUID_RE.test(id)) {
          actorIds.add(id);
          break;
        }
      }
    }
  }

  const [tasks, actors] = await Promise.all([
    taskIds.size > 0
      ? prisma.task.findMany({
          where: { id: { in: [...taskIds] } },
          select: { id: true, name: true, dueDate: true, division: { select: { name: true } } },
        })
      : Promise.resolve([]),
    actorIds.size > 0
      ? prisma.user.findMany({
          where: { id: { in: [...actorIds] } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const nameById = new Map(actors.map((u) => [u.id, u.name]));

  for (const { id, type, payload } of rows) {
    const taskIdRaw = typeof payload.taskId === 'string' ? payload.taskId : undefined;
    const task = taskIdRaw ? taskById.get(taskIdRaw) : undefined;

    const taskName =
      task?.name ??
      (typeof payload.taskName === 'string' && payload.taskName.trim()
        ? payload.taskName.trim()
        : null);
    if (!taskName) continue; // not a task-linked notification, or the task is gone with no snapshot

    const divisionName = task?.division.name ?? null;

    // When the task still exists its due date wins — even if null (cleared).
    const dueDate =
      task !== undefined
        ? task.dueDate
        : typeof payload.dueDate === 'string' && !Number.isNaN(Date.parse(payload.dueDate))
          ? new Date(payload.dueDate)
          : null;

    const actorLabel = ACTOR_LABEL[type] ?? null;
    let actorName: string | null = null;
    if (actorLabel) {
      for (const key of ACTOR_NAME_KEYS) {
        const v = payload[key];
        if (typeof v === 'string' && v.trim()) {
          actorName = v.trim();
          break;
        }
      }
      if (!actorName) {
        for (const key of ACTOR_ID_KEYS) {
          const v = payload[key];
          if (typeof v === 'string' && nameById.has(v)) {
            actorName = nameById.get(v) ?? null;
            break;
          }
        }
      }
    }

    context.set(id, { taskName, divisionName, dueDate, actorLabel, actorName });
  }

  return context;
}
