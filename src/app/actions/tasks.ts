'use server';
import { logError } from '@/lib/utils/log';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { Prisma } from '@prisma/client';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { parseDueDateInput } from '@/lib/format';
import {
  canActAsHeadOf,
  canAssignTaskTo,
  canCreateDivisionTask,
  canTransferTaskTo,
  getRbacActor,
  getRbacTarget,
  resolveDivisionOwner,
} from '@/lib/rbac';
import { buildVisibilityClauses } from '@/lib/visibility';

async function nextTaskRefNumber(
  divisionId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<string> {
  const div = await tx.division.update({
    where: { id: divisionId },
    data: { taskSeq: { increment: 1 } },
    select: { abbreviation: true, taskSeq: true },
  });
  const prefix = div.abbreviation || 'GEN';
  return `T-${prefix}${div.taskSeq}`;
}

/**
 * Task server actions.
 *
 * Each action validates with Zod, checks the caller's session, writes the
 * entity row + a `task_activity` event, and revalidates the affected paths.
 *
 * Permissions for Phase 1: a caller who can see a task can edit it. The
 * audit log (`task_activity`) preserves who did what. Tightened in Phase 2+
 * via the same scoper used for reads.
 */

// ============================================================
// Shared
// ============================================================

const STATUSES = ['not_started', 'in_progress', 'awaiting_input', 'on_hold', 'completed'] as const;
const PRIORITY = ['low', 'medium', 'high', 'urgent'] as const;
const VISIBILITY = ['division', 'personal'] as const;

type ActionState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Counter so identical successive successes are observable in useEffect. */
  epoch?: number;
};

function bump(prev: ActionState | undefined): number {
  return (prev?.epoch ?? 0) + 1;
}

function fail(message: string, epoch: number, fieldErrors?: Record<string, string>): ActionState {
  return { ok: false, error: message, epoch, fieldErrors };
}

function ok(epoch: number): ActionState {
  return { ok: true, epoch };
}

async function requireSession() {
  const session = await auth();
  if (!session?.user) return null;
  return session.user;
}

function revalidateTask(taskId: string) {
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath('/tasks');
}

function nextOccurrence(
  base: Date,
  rule: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'half_yearly',
): Date {
  const d = new Date(base);
  switch (rule) {
    case 'daily':
      d.setUTCDate(d.getUTCDate() + 1);
      break;
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case 'monthly':
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case 'quarterly':
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
    case 'half_yearly':
      d.setUTCMonth(d.getUTCMonth() + 6);
      break;
  }
  return d;
}

async function spawnRecurringTask(taskId: string, actorId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      name: true,
      description: true,
      ownerId: true,
      divisionId: true,
      subDivisionId: true,
      priority: true,
      visibility: true,
      dueDate: true,
      recurrenceRule: true,
      createdById: true,
      linkedTimelineFileId: true,
    },
  });
  if (!task?.recurrenceRule || !task.dueDate) return;

  const nextDue = nextOccurrence(task.dueDate, task.recurrenceRule);

  await prisma.$transaction(async (tx) => {
    const refNumber = await nextTaskRefNumber(task.divisionId, tx);
    const spawned = await tx.task.create({
      data: {
        refNumber,
        name: task.name,
        description: task.description,
        ownerId: task.ownerId,
        divisionId: task.divisionId,
        subDivisionId: task.subDivisionId,
        priority: task.priority,
        visibility: task.visibility,
        dueDate: nextDue,
        recurrenceRule: task.recurrenceRule,
        createdById: task.createdById,
        linkedTimelineFileId: task.linkedTimelineFileId,
      },
    });
    await tx.taskActivity.create({
      data: {
        taskId: spawned.id,
        actorId,
        eventType: 'recurrence_spawned',
        payload: { sourceTaskId: taskId },
      },
    });
  });
}

async function canEditTask(
  callerId: string,
  task: { ownerId: string; createdById: string; divisionId: string },
): Promise<boolean> {
  if (task.ownerId === callerId || task.createdById === callerId) return true;
  const caller = await prisma.user.findUnique({
    where: { id: callerId },
    select: { isSuperAdmin: true, hierarchySlot: true, divisionId: true },
  });
  if (!caller) return false;
  if (caller.isSuperAdmin) return true;
  if (caller.hierarchySlot === 'js' || caller.hierarchySlot === 'osd') return true;
  if (caller.hierarchySlot === 'director' && caller.divisionId === task.divisionId) return true;
  // Division heads (direct or via active delegation) manage the tasks of
  // divisions they head — heads are not always director-slot users.
  const actor = await getRbacActor(callerId);
  return actor !== null && canActAsHeadOf(actor, task.divisionId);
}

/**
 * Editing a task's definition — its name, due date, milestone, or
 * recurrence — and deleting it are privileged actions. Unlike canEditTask,
 * simply owning the task is NOT enough: a normal user who receives a task
 * (e.g. via transfer) can work it (status, subtasks) but cannot redefine
 * or delete it. Allowed for a Super Admin, OSD, JS, a director of the
 * task's division, or its head — and for a user's own personal task, which
 * only they can see.
 */
async function canEditTaskDetails(
  callerId: string,
  task: { ownerId: string; divisionId: string; visibility: string },
): Promise<boolean> {
  if (task.visibility === 'personal' && task.ownerId === callerId) return true;
  const caller = await prisma.user.findUnique({
    where: { id: callerId },
    select: { isSuperAdmin: true, hierarchySlot: true, divisionId: true },
  });
  if (!caller) return false;
  if (caller.isSuperAdmin) return true;
  if (caller.hierarchySlot === 'js' || caller.hierarchySlot === 'osd') return true;
  if (caller.hierarchySlot === 'director' && caller.divisionId === task.divisionId) return true;
  const actor = await getRbacActor(callerId);
  return actor !== null && canActAsHeadOf(actor, task.divisionId);
}

async function canViewTask(callerId: string, taskId: string): Promise<boolean> {
  const me = await prisma.user.findUnique({
    where: { id: callerId },
    select: { id: true, hierarchySlot: true, isSuperAdmin: true, divisionId: true, isPmu: true },
  });
  if (!me) return false;
  const visibilityClauses = await buildVisibilityClauses(me);
  const count = await prisma.task.count({
    where: { id: taskId, OR: visibilityClauses },
  });
  return count > 0;
}

// ============================================================
// createTask — turn B
// ============================================================

const createTaskSchema = z.object({
  name: z.string().trim().min(1, 'Task name is required').max(200, 'Task name is too long'),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined)),
  dueDate: z
    .string()
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined))
    .refine((s) => !s || !Number.isNaN(Date.parse(s)), 'Due date is invalid'),
  priority: z.enum(PRIORITY).default('low'),
  visibility: z.enum(VISIBILITY).default('division'),
  milestone: z
    .string()
    .optional()
    .transform((s) => s === 'on'),
  divisionId: z.string().uuid().optional(),
  // Optional sub-division within the target division — a Division row of
  // kind 'sub_division' whose parent is the target. Categorisation only; it
  // does not affect ownership or visibility. Empty string → undefined.
  subDivisionId: z
    .union([z.literal(''), z.string().uuid()])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  // Optional initial owner, named by a head at creation (see below). Empty
  // string → undefined so "unassigned" stays the default.
  ownerId: z
    .union([z.literal(''), z.string().uuid()])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  linkedTimelineFileId: z
    .union([z.literal(''), z.string().uuid()])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  driveUrl: z
    .string()
    .trim()
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined))
    .refine((s) => !s || /^https?:\/\//.test(s), 'URL must start with http:// or https://')
    .refine((s) => !s || s.length <= 1000, 'URL is too long'),
});

type CreateTaskState = ActionState & { taskId?: string };
const INITIAL_CREATE_STATE: CreateTaskState = { ok: false, epoch: 0 };

export async function createTaskAction(
  prev: CreateTaskState | undefined,
  formData: FormData,
): Promise<CreateTaskState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out. Refresh and try again.', epoch);

  const parsed = createTaskSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    dueDate: formData.get('dueDate'),
    priority: formData.get('priority') ?? 'low',
    visibility: formData.get('visibility') ?? 'division',
    milestone: formData.get('milestone'),
    divisionId: formData.get('divisionId') || undefined,
    subDivisionId: formData.get('subDivisionId') || undefined,
    ownerId: formData.get('ownerId') || undefined,
    linkedTimelineFileId: formData.get('linkedTimelineFileId') || undefined,
    driveUrl: formData.get('driveUrl') || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (key === 'name' || key === 'dueDate' || key === 'driveUrl' || key === 'subDivisionId')
        fieldErrors[key] = issue.message;
    }
    return { ok: false, fieldErrors, epoch };
  }

  const meRow = await prisma.user.findUnique({
    where: { id: me.id },
    select: { id: true, divisionId: true },
  });
  if (!meRow) return fail('Your account could not be found.', epoch);

  const targetDivisionId = parsed.data.divisionId ?? meRow.divisionId;
  const actor = await getRbacActor(me.id);
  if (!actor) return fail('Your account could not be found.', epoch);

  // Division-level tasks are given by heads: only Super Admin, OSD, the
  // target division's head, or an active delegate may create a task with
  // 'division' visibility. Everyone else creates personal tasks. The same
  // predicate covers creating in another division — including spawning
  // from a Timeline File, which always produces a division-level task.
  const hasDivisionPower = canCreateDivisionTask(actor, targetDivisionId);
  if (parsed.data.visibility === 'division' && !hasDivisionPower) {
    return fail('Only the division head can create division-level tasks.', epoch);
  }
  if (targetDivisionId !== meRow.divisionId && !hasDivisionPower) {
    return fail('You can only create tasks in your own division.', epoch);
  }

  // By default a new division task starts unassigned: the owner is left as
  // the creator, which the pull flow (pullTaskAction) treats as "no owner
  // yet". The task is division-visible, so any member can see it and pull it
  // to take ownership. Personal tasks are simply owned by their creator.
  //
  // A head may instead name an initial owner up front (the optional owner
  // picker). It must be an active member of the target division — the same
  // pool ownership already resolves to — and only a division-task creator
  // (hasDivisionPower, required above) can set it.
  //
  // PMUs are the exception to the unassigned default: PMU-team visibility is
  // owner-scoped (a member sees tasks owned by a teammate, not a division
  // board — see buildVisibilityClausesFrom), so a PMU task must be owned by a
  // PMU member to stay visible to the team. Absent an explicit pick it keeps
  // the Structure & Hierarchy default: the PMU's team leader (falling back to
  // the creator when unset).
  let ownerId = meRow.id;
  // A sub-division tag is only meaningful on a division task and must belong
  // to the target division (a Division row of kind 'sub_division' whose
  // parent is the target). Personal tasks never carry one.
  let subDivisionId: string | null = null;
  if (parsed.data.visibility === 'division') {
    const targetDivision = await prisma.division.findUnique({
      where: { id: targetDivisionId },
      select: { kind: true, name: true },
    });
    // Office of JS tasks may be owned by any active user (same identifier as
    // getOfficeOfJsDivisionId — the seeded division name).
    const isOfficeOfJs = targetDivision?.name === 'Office of JS';

    if (parsed.data.subDivisionId) {
      const sub = await prisma.division.findUnique({
        where: { id: parsed.data.subDivisionId },
        select: { id: true, kind: true, parentId: true },
      });
      if (!sub || sub.kind !== 'sub_division' || sub.parentId !== targetDivisionId) {
        return {
          ok: false,
          fieldErrors: { subDivisionId: 'Choose a sub-division of this division.' },
          epoch,
        };
      }
      subDivisionId = sub.id;
    }

    if (parsed.data.ownerId) {
      const chosen = await prisma.user.findUnique({
        where: { id: parsed.data.ownerId },
        select: { id: true, isActive: true, divisionId: true, pmuId: true },
      });
      const isMember =
        !!chosen &&
        chosen.isActive &&
        (isOfficeOfJs
          ? true
          : targetDivision?.kind === 'pmu'
            ? chosen.pmuId === targetDivisionId
            : chosen.divisionId === targetDivisionId);
      if (!isMember) {
        return {
          ok: false,
          fieldErrors: { ownerId: 'Choose an owner from this division.' },
          epoch,
        };
      }
      ownerId = chosen.id;
    } else if (targetDivision?.kind === 'pmu') {
      ownerId = await resolveDivisionOwner(targetDivisionId, meRow.id);
    }
  }

  try {
    const task = await prisma.$transaction(async (tx) => {
      const refNumber = await nextTaskRefNumber(targetDivisionId, tx);
      const created = await tx.task.create({
        data: {
          refNumber,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          ownerId,
          divisionId: targetDivisionId,
          subDivisionId,
          status: 'not_started',
          priority: parsed.data.priority,
          visibility: parsed.data.visibility,
          dueDate: parsed.data.dueDate ? parseDueDateInput(parsed.data.dueDate) : null,
          milestone: parsed.data.milestone ?? false,
          linkedTimelineFileId: parsed.data.linkedTimelineFileId ?? null,
          createdById: meRow.id,
        },
      });

      if (parsed.data.linkedTimelineFileId) {
        await tx.timelineFileTaskLink.create({
          data: {
            timelineFileId: parsed.data.linkedTimelineFileId,
            taskId: created.id,
            linkedById: meRow.id,
          },
        });
        await tx.timelineFileActivity.create({
          data: {
            timelineFileId: parsed.data.linkedTimelineFileId,
            actorId: meRow.id,
            eventType: 'task_linked',
            payload: { taskId: created.id, taskName: created.name },
          },
        });
      }

      await tx.taskActivity.create({
        data: {
          taskId: created.id,
          actorId: meRow.id,
          eventType: 'task_created',
          payload: { name: created.name, priority: created.priority, milestone: created.milestone },
        },
      });

      if (parsed.data.driveUrl) {
        const url = parsed.data.driveUrl;
        let fileName = 'Linked file';
        try {
          const urlObj = new URL(url);
          const pathParts = urlObj.pathname.split('/').filter(Boolean);
          if (pathParts.length > 0) {
            const last = pathParts[pathParts.length - 1];
            if (last.length > 0 && last.length < 100) fileName = decodeURIComponent(last);
          }
        } catch {
          // Keep default fileName
        }

        await tx.attachment.create({
          data: {
            ownerType: 'task',
            ownerId: created.id,
            fileName,
            fileUrl: url,
            mimeType: null,
            sizeBytes: null,
            source: 'drive_link',
            uploadedById: meRow.id,
          },
        });
      }

      return created;
    });

    // When ownership was auto-assigned to a PMU team leader other than the
    // creator, let them know they now own the task. (Regular division tasks
    // start unassigned, so ownerId === meRow.id and this does not fire.)
    if (ownerId !== meRow.id) {
      await prisma.notification.create({
        data: {
          userId: ownerId,
          type: 'task_assigned',
          payload: {
            taskId: task.id,
            taskName: task.name,
            assignedById: meRow.id,
            assignedByName: me.name ?? null,
            dueDate: task.dueDate?.toISOString() ?? null,
          },
        },
      });
    }

    if (parsed.data.linkedTimelineFileId) {
      revalidatePath(`/timeline-files/${parsed.data.linkedTimelineFileId}`);
    }
    revalidatePath('/tasks');
    return { ok: true, taskId: task.id, epoch };
  } catch (err) {
    logError('createTaskAction failed', err);
    return fail('Could not save the task. Try again.', epoch);
  }
}

// ============================================================
// updateTaskStatus — picker + optional note
// ============================================================

const updateStatusSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(STATUSES),
  note: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined)),
});

type UpdateStatusState = ActionState;
const INITIAL_STATUS_STATE: UpdateStatusState = { ok: false, epoch: 0 };

export async function updateTaskStatusAction(
  prev: UpdateStatusState | undefined,
  formData: FormData,
): Promise<UpdateStatusState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = updateStatusSchema.safeParse({
    taskId: formData.get('taskId'),
    status: formData.get('status'),
    // `.get()` yields null when the form omits the note (e.g. the one-tap
    // complete tick, which posts only taskId + status). The optional schema
    // rejects null but accepts undefined, so coalesce — a missing note must
    // not fail the whole action.
    note: formData.get('note') ?? undefined,
  });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const task = await prisma.task.findUnique({
    where: { id: parsed.data.taskId },
    select: { id: true, name: true, status: true, ownerId: true, createdById: true, divisionId: true, recurrenceRule: true },
  });
  if (!task) return fail('Task not found.', epoch);

  if (!(await canEditTask(me.id, task))) {
    return fail('Only the task owner, creator, or head of division can change status.', epoch);
  }

  const noChange = task.status === parsed.data.status;
  if (noChange && !parsed.data.note) return ok(epoch);

  try {
    await prisma.$transaction(async (tx) => {
      if (!noChange) {
        await tx.task.update({
          where: { id: task.id },
          data: { status: parsed.data.status },
        });
        await tx.taskActivity.create({
          data: {
            taskId: task.id,
            actorId: me.id,
            eventType: 'status_changed',
            payload: { from: task.status, to: parsed.data.status },
          },
        });
      }
      if (parsed.data.note) {
        await tx.taskComment.create({
          data: {
            taskId: task.id,
            userId: me.id,
            body: parsed.data.note,
            statusTransition: noChange ? null : parsed.data.status,
            mentions: extractMentionIds(parsed.data.note),
          },
        });
      }
    });

    if (!noChange) {
      const notifs: Prisma.NotificationCreateManyInput[] = [];

      if (task.ownerId !== me.id) {
        notifs.push({
          userId: task.ownerId,
          type: 'status_changed_on_my_task',
          payload: {
            taskId: task.id,
            taskName: task.name,
            from: task.status,
            to: parsed.data.status,
            actorId: me.id,
            actorName: me.name ?? null,
          },
        });
      }

      const divLeads = await prisma.taskCollaborator.findMany({
        where: { taskId: task.id, role: 'division_lead' },
        select: { userId: true },
      });
      for (const dl of divLeads) {
        if (dl.userId !== me.id) {
          notifs.push({
            userId: dl.userId,
            type: 'cross_division_status_change',
            payload: {
              taskId: task.id,
              taskName: task.name,
              from: task.status,
              to: parsed.data.status,
              actorId: me.id,
              actorName: me.name ?? null,
            },
          });
        }
      }

      if (notifs.length > 0) {
        await prisma.notification.createMany({ data: notifs });
      }
    }

    if (parsed.data.status === 'completed' && task.recurrenceRule) {
      await spawnRecurringTask(task.id, me.id);
    }
  } catch (err) {
    logError('updateTaskStatusAction failed', err);
    return fail('Could not change status.', epoch);
  }

  revalidateTask(task.id);
  return ok(epoch);
}

// ============================================================
// updateTaskPriority
// ============================================================

const updatePrioritySchema = z.object({
  taskId: z.string().uuid(),
  priority: z.enum(PRIORITY),
});

type UpdatePriorityState = ActionState;
const INITIAL_PRIORITY_STATE: UpdatePriorityState = { ok: false, epoch: 0 };

export async function updateTaskPriorityAction(
  prev: UpdatePriorityState | undefined,
  formData: FormData,
): Promise<UpdatePriorityState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = updatePrioritySchema.safeParse({
    taskId: formData.get('taskId'),
    priority: formData.get('priority'),
  });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const task = await prisma.task.findUnique({ where: { id: parsed.data.taskId } });
  if (!task) return fail('Task not found.', epoch);

  if (!(await canEditTask(me.id, task))) {
    return fail('Only the task owner, creator, or head of division can change priority.', epoch);
  }

  if (task.priority === parsed.data.priority) return ok(epoch);

  try {
    await prisma.$transaction([
      prisma.task.update({
        where: { id: task.id },
        data: { priority: parsed.data.priority },
      }),
      prisma.taskActivity.create({
        data: {
          taskId: task.id,
          actorId: me.id,
          eventType: 'priority_changed',
          payload: { from: task.priority, to: parsed.data.priority },
        },
      }),
    ]);
  } catch (err) {
    logError('updateTaskPriorityAction failed', err);
    return fail('Could not change priority.', epoch);
  }

  revalidateTask(task.id);
  return ok(epoch);
}

// ============================================================
// updateTaskFields — generic editor for description, due date, visibility, milestone
// ============================================================

const updateFieldsSchema = z.object({
  taskId: z.string().uuid(),
  name: z
    .string()
    .trim()
    .min(1, 'Task name is required')
    .max(200, 'Task name is too long')
    .optional(),
  description: z
    .string()
    .max(5000)
    .optional()
    .transform((s) => (typeof s === 'string' ? s : undefined)),
  // Distinguishes "field absent" (undefined — leave the due date alone,
  // e.g. when saving an unrelated field like the title) from "field
  // present but empty" (null — an explicit clear via the Due row's Clear
  // button). A naive `s ? s : null` collapses both to null and silently
  // wipes the due date on every edit that doesn't touch it.
  dueDate: z
    .string()
    .optional()
    .transform((s) => (s === undefined ? undefined : s.length > 0 ? s : null))
    .refine(
      (s) => s === undefined || s === null || !Number.isNaN(Date.parse(s)),
      'Due date is invalid',
    ),
  visibility: z.enum(VISIBILITY).optional(),
  milestone: z
    .string()
    .optional()
    .transform((s) => (s === undefined ? undefined : s === 'on')),
  recurrenceRule: z
    .union([
      z.literal(''),
      z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'half_yearly']),
    ])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === '' ? null : v)),
  divisionId: z.string().uuid().optional(),
  // Empty string is an explicit clear (null — "no sub-division"); absent is
  // "leave alone" (undefined), the same distinction the recurrence field draws.
  subDivisionId: z
    .union([z.literal(''), z.string().uuid()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === '' ? null : v)),
});

type UpdateFieldsState = ActionState;
const INITIAL_FIELDS_STATE: UpdateFieldsState = { ok: false, epoch: 0 };

export async function updateTaskFieldsAction(
  prev: UpdateFieldsState | undefined,
  formData: FormData,
): Promise<UpdateFieldsState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = updateFieldsSchema.safeParse({
    taskId: formData.get('taskId'),
    name: formData.has('name') ? (formData.get('name') as string) : undefined,
    description: formData.has('description') ? (formData.get('description') as string) : undefined,
    dueDate: formData.has('dueDate') ? (formData.get('dueDate') as string) : undefined,
    visibility: formData.has('visibility')
      ? (formData.get('visibility') as string)
      : undefined,
    milestone: formData.has('milestone') ? (formData.get('milestone') as string) : undefined,
    recurrenceRule: formData.has('recurrenceRule')
      ? (formData.get('recurrenceRule') as string)
      : undefined,
    divisionId: formData.has('divisionId') ? (formData.get('divisionId') as string) : undefined,
    subDivisionId: formData.has('subDivisionId')
      ? (formData.get('subDivisionId') as string)
      : undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, fieldErrors, epoch };
  }

  const task = await prisma.task.findUnique({ where: { id: parsed.data.taskId } });
  if (!task) return fail('Task not found.', epoch);

  if (!(await canEditTask(me.id, task))) {
    return fail('Only the task owner, creator, or head of division can edit this task.', epoch);
  }

  // Name, due date, milestone, and recurrence redefine the task, so they
  // need the stricter gate — a normal owner (e.g. after a transfer) may
  // still change status/subtasks/description, but not these. Each editor
  // posts only its own field, so presence is a reliable signal.
  const editsDefinition =
    parsed.data.name !== undefined ||
    parsed.data.dueDate !== undefined ||
    parsed.data.milestone !== undefined ||
    parsed.data.recurrenceRule !== undefined ||
    parsed.data.subDivisionId !== undefined;
  if (editsDefinition && !(await canEditTaskDetails(me.id, task))) {
    return fail(
      'Only a division head, OSD, JS, or Super Admin can change the name, due date, milestone, recurrence, or sub-division.',
      epoch,
    );
  }

  const data: Record<string, unknown> = {};
  const events: { eventType: string; payload: Record<string, unknown> }[] = [];
  // Set when a division/PMU change auto-reassigns ownership, so the new
  // owner can be notified after the write commits.
  let reassignedOwnerId: string | null = null;

  if (parsed.data.name !== undefined && parsed.data.name !== task.name) {
    data.name = parsed.data.name;
    events.push({
      eventType: 'task_renamed',
      payload: { from: task.name, to: parsed.data.name },
    });
  }
  if (parsed.data.description !== undefined && parsed.data.description !== (task.description ?? '')) {
    data.description = parsed.data.description.length > 0 ? parsed.data.description : null;
    events.push({ eventType: 'description_updated', payload: {} });
  }
  if (parsed.data.dueDate !== undefined) {
    const next = parsed.data.dueDate ? parseDueDateInput(parsed.data.dueDate) : null;
    // Compare full timestamps so a time-of-day change also registers; the
    // activity payload stays date-only for legible rendering.
    if ((task.dueDate?.getTime() ?? null) !== (next?.getTime() ?? null)) {
      data.dueDate = next;
      events.push({
        eventType: 'due_date_changed',
        payload: {
          from: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
          to: next ? next.toISOString().slice(0, 10) : null,
        },
      });
    }
  }
  if (parsed.data.visibility !== undefined && parsed.data.visibility !== task.visibility) {
    // Visibility is a head power in both directions — the same rule as
    // creating a division-level task. Owners/creators who can edit other
    // fields may neither promote a task onto the division board nor hide
    // a division task from it.
    const actor = await getRbacActor(me.id);
    if (!actor || !canCreateDivisionTask(actor, task.divisionId)) {
      return fail('Only the division head can change task visibility.', epoch);
    }
    data.visibility = parsed.data.visibility;
    events.push({
      eventType: 'visibility_changed',
      payload: { from: task.visibility, to: parsed.data.visibility },
    });
  }
  if (parsed.data.milestone !== undefined && parsed.data.milestone !== task.milestone) {
    data.milestone = parsed.data.milestone;
    events.push({
      eventType: 'milestone_toggled',
      payload: { milestone: parsed.data.milestone },
    });
  }
  if (
    parsed.data.recurrenceRule !== undefined &&
    parsed.data.recurrenceRule !== task.recurrenceRule
  ) {
    data.recurrenceRule = parsed.data.recurrenceRule;
    events.push({
      eventType: 'recurrence_changed',
      payload: { from: task.recurrenceRule, to: parsed.data.recurrenceRule },
    });
  }
  if (
    parsed.data.subDivisionId !== undefined &&
    parsed.data.subDivisionId !== task.subDivisionId
  ) {
    // A sub-division must belong to the task's current division. Changing the
    // division is a separate action that clears the sub-division below, so
    // here we validate against task.divisionId. null clears the tag.
    let toName: string | null = null;
    if (parsed.data.subDivisionId !== null) {
      const sub = await prisma.division.findUnique({
        where: { id: parsed.data.subDivisionId },
        select: { id: true, name: true, kind: true, parentId: true },
      });
      if (!sub || sub.kind !== 'sub_division' || sub.parentId !== task.divisionId) {
        return fail('Choose a sub-division of this division.', epoch, {
          subDivisionId: 'Choose a sub-division of this division.',
        });
      }
      toName = sub.name;
    }
    const fromName = task.subDivisionId
      ? (
          await prisma.division.findUnique({
            where: { id: task.subDivisionId },
            select: { name: true },
          })
        )?.name ?? null
      : null;
    data.subDivisionId = parsed.data.subDivisionId;
    events.push({
      eventType: 'subdivision_changed',
      payload: { from: fromName, to: toName },
    });
  }
  if (parsed.data.divisionId !== undefined && parsed.data.divisionId !== task.divisionId) {
    const meRow = await prisma.user.findUnique({
      where: { id: me.id },
      select: { isSuperAdmin: true, hierarchySlot: true },
    });
    if (!meRow?.isSuperAdmin && meRow?.hierarchySlot !== 'osd') {
      return fail('Only OSD or Super Admin can change the division.', epoch);
    }
    data.divisionId = parsed.data.divisionId;
    // The current sub-division belongs to the old division's subtree, so it
    // no longer applies — clear it as part of the move.
    if (task.subDivisionId) data.subDivisionId = null;
    const oldDiv = await prisma.division.findUnique({ where: { id: task.divisionId }, select: { name: true } });
    const newDiv = await prisma.division.findUnique({ where: { id: parsed.data.divisionId }, select: { name: true } });
    events.push({
      eventType: 'division_changed',
      payload: { from: oldDiv?.name ?? task.divisionId, to: newDiv?.name ?? parsed.data.divisionId },
    });

    // Ownership follows the new division/PMU per Structure & Hierarchy: the
    // new division's head, or the PMU's team leader (falling back to the
    // creator when unset). Reassign, log it, and notify the new owner.
    const nextOwnerId = await resolveDivisionOwner(parsed.data.divisionId, task.createdById);
    if (nextOwnerId !== task.ownerId) {
      const nextOwner = await prisma.user.findUnique({
        where: { id: nextOwnerId },
        select: { name: true },
      });
      data.ownerId = nextOwnerId;
      events.push({
        eventType: 'owner_changed',
        payload: { from: task.ownerId, to: nextOwnerId, toName: nextOwner?.name ?? null },
      });
      reassignedOwnerId = nextOwnerId;
    }
  }

  if (Object.keys(data).length === 0) return ok(epoch);

  try {
    await prisma.$transaction([
      prisma.task.update({ where: { id: task.id }, data }),
      ...events.map((e) =>
        prisma.taskActivity.create({
          data: { taskId: task.id, actorId: me.id, eventType: e.eventType, payload: e.payload as object },
        }),
      ),
    ]);
  } catch (err) {
    logError('updateTaskFieldsAction failed', err);
    return fail('Could not save changes.', epoch);
  }

  // Notify the head / team leader who now owns the task after a division
  // or PMU change (self-excluded).
  if (reassignedOwnerId && reassignedOwnerId !== me.id) {
    await prisma.notification.create({
      data: {
        userId: reassignedOwnerId,
        type: 'task_assigned',
        payload: {
          taskId: task.id,
          taskName: task.name,
          assignedById: me.id,
          assignedByName: me.name ?? null,
          dueDate: task.dueDate?.toISOString() ?? null,
        },
      },
    });
  }

  revalidateTask(task.id);
  return ok(epoch);
}

// ============================================================
// Subtasks — add + toggle
// ============================================================

const addSubtaskSchema = z.object({
  parentTaskId: z.string().uuid(),
  name: z.string().trim().min(1, 'Subtask name is required').max(200),
  assigneeId: z.string().uuid().optional(),
  dueDate: z
    .string()
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined))
    .refine((s) => !s || !Number.isNaN(Date.parse(s)), 'Due date is invalid'),
});

export async function addSubtaskAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = addSubtaskSchema.safeParse({
    parentTaskId: formData.get('parentTaskId'),
    name: formData.get('name'),
    assigneeId: formData.get('assigneeId') || undefined,
    dueDate: formData.get('dueDate'),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors, epoch };
  }

  const parent = await prisma.task.findUnique({
    where: { id: parsed.data.parentTaskId },
    select: {
      id: true,
      divisionId: true,
      subDivisionId: true,
      visibility: true,
      ownerId: true,
      createdById: true,
      dueDate: true,
    },
  });
  if (!parent) return fail('Parent task not found.', epoch);

  // A subtask inherits the parent's visibility, so adding one to a
  // division task creates another division-level task. Gate it the same
  // way as every other subtask mutation (updateSubtaskAction) — owner,
  // creator, or a head/OSD/Super Admin of the parent's division — so a
  // division user cannot mint division tasks by breaking down a task
  // they merely collaborate on.
  if (!(await canEditTask(me.id, parent))) {
    return fail('Only the task owner, creator, or head of division can add subtasks.', epoch);
  }

  if (parsed.data.dueDate && parent.dueDate) {
    const subtaskDue = new Date(parsed.data.dueDate);
    const parentEndOfDay = new Date(parent.dueDate);
    parentEndOfDay.setHours(23, 59, 59, 999);
    if (subtaskDue > parentEndOfDay) {
      return { ok: false, fieldErrors: { dueDate: 'Subtask deadline cannot exceed the parent task deadline' }, epoch };
    }
  }

  const assigneeId = parsed.data.assigneeId ?? me.id;

  if (assigneeId !== me.id) {
    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true, isActive: true, divisionId: true },
    });
    if (!assignee || !assignee.isActive) {
      return fail('Assignee not found or inactive.', epoch);
    }
    if (assignee.divisionId !== parent.divisionId) {
      return fail('Subtask assignee must be in the same division as the parent task.', epoch);
    }
  }

  try {
    const subtask = await prisma.$transaction(async (tx) => {
      const refNumber = await nextTaskRefNumber(parent.divisionId, tx);
      return tx.task.create({
        data: {
          refNumber,
          name: parsed.data.name,
          ownerId: assigneeId,
          divisionId: parent.divisionId,
          subDivisionId: parent.subDivisionId,
          status: 'not_started',
          priority: 'low',
          visibility: parent.visibility,
          dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
          parentTaskId: parent.id,
          createdById: me.id,
        },
      });
    });
    await prisma.taskActivity.create({
      data: {
        taskId: parent.id,
        actorId: me.id,
        eventType: 'subtask_added',
        payload: { name: subtask.name, subtaskId: subtask.id, assigneeId: assigneeId !== me.id ? assigneeId : undefined },
      },
    });
    if (assigneeId !== me.id) {
      await prisma.notification.create({
        data: {
          userId: assigneeId,
          type: 'task_assigned',
          payload: {
            taskId: subtask.id,
            taskName: subtask.name,
            parentTaskId: parent.id,
            assignedById: me.id,
            assignedByName: me.name ?? null,
            dueDate: subtask.dueDate?.toISOString() ?? null,
          },
        },
      });
    }
  } catch (err) {
    logError('addSubtaskAction failed', err);
    return fail('Could not add subtask.', epoch);
  }

  revalidateTask(parent.id);
  return ok(epoch);
}

const toggleSubtaskSchema = z.object({ subtaskId: z.string().uuid() });

export async function toggleSubtaskAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = toggleSubtaskSchema.safeParse({ subtaskId: formData.get('subtaskId') });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const subtask = await prisma.task.findUnique({
    where: { id: parsed.data.subtaskId },
    select: { id: true, status: true, parentTaskId: true, name: true },
  });
  if (!subtask) return fail('Subtask not found.', epoch);

  if (subtask.parentTaskId) {
    const parent = await prisma.task.findUnique({
      where: { id: subtask.parentTaskId },
      select: { id: true, ownerId: true, createdById: true, divisionId: true },
    });
    if (!parent || !(await canEditTask(me.id, parent))) {
      return fail('You do not have permission to modify this task.', epoch);
    }
  }

  const nextStatus = subtask.status === 'completed' ? 'not_started' : 'completed';
  const eventType = nextStatus === 'completed' ? 'subtask_completed' : 'subtask_reopened';

  try {
    await prisma.$transaction([
      prisma.task.update({ where: { id: subtask.id }, data: { status: nextStatus } }),
      ...(subtask.parentTaskId
        ? [
            prisma.taskActivity.create({
              data: {
                taskId: subtask.parentTaskId,
                actorId: me.id,
                eventType,
                payload: { subtaskId: subtask.id, name: subtask.name },
              },
            }),
          ]
        : []),
    ]);
  } catch (err) {
    logError('toggleSubtaskAction failed', err);
    return fail('Could not toggle subtask.', epoch);
  }

  if (subtask.parentTaskId) revalidateTask(subtask.parentTaskId);
  revalidatePath('/tasks');
  return ok(epoch);
}

// ============================================================
// updateSubtask — reassign + deadline
// ============================================================

const updateSubtaskSchema = z.object({
  subtaskId: z.string().uuid(),
  assigneeId: z.string().uuid().optional(),
  dueDate: z
    .string()
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined))
    .refine((s) => !s || !Number.isNaN(Date.parse(s)), 'Due date is invalid'),
});

export async function updateSubtaskAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = updateSubtaskSchema.safeParse({
    subtaskId: formData.get('subtaskId'),
    assigneeId: formData.get('assigneeId') || undefined,
    dueDate: formData.get('dueDate') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors, epoch };
  }

  const subtask = await prisma.task.findUnique({
    where: { id: parsed.data.subtaskId },
    select: { id: true, parentTaskId: true, ownerId: true, name: true, dueDate: true },
  });
  if (!subtask || !subtask.parentTaskId) return fail('Subtask not found.', epoch);

  const parent = await prisma.task.findUnique({
    where: { id: subtask.parentTaskId },
    select: { id: true, ownerId: true, createdById: true, divisionId: true, dueDate: true },
  });
  if (!parent) return fail('Parent task not found.', epoch);

  const allowed = await canEditTask(me.id, parent);
  if (!allowed) return fail('You do not have permission to edit this subtask.', epoch);

  if (parsed.data.dueDate && parent.dueDate) {
    const subtaskDue = new Date(parsed.data.dueDate);
    const parentEndOfDay = new Date(parent.dueDate);
    parentEndOfDay.setHours(23, 59, 59, 999);
    if (subtaskDue > parentEndOfDay) {
      return { ok: false, fieldErrors: { dueDate: 'Subtask deadline cannot exceed the parent task deadline' }, epoch };
    }
  }

  const updates: Record<string, unknown> = {};
  const activityChanges: string[] = [];
  // Extra activity detail for a reassignment — who it moved from and to —
  // so the log plainly records the hand-off, not just "reassigned".
  let reassignDetail: {
    fromId?: string;
    fromName?: string | null;
    toId?: string;
    toName?: string | null;
  } = {};

  if (parsed.data.assigneeId && parsed.data.assigneeId !== subtask.ownerId) {
    updates.ownerId = parsed.data.assigneeId;
    activityChanges.push('reassigned');
    const [fromUser, toUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: subtask.ownerId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: parsed.data.assigneeId }, select: { name: true } }),
    ]);
    reassignDetail = {
      fromId: subtask.ownerId,
      fromName: fromUser?.name ?? null,
      toId: parsed.data.assigneeId,
      toName: toUser?.name ?? null,
    };
  }
  if (parsed.data.dueDate !== undefined) {
    updates.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    activityChanges.push('deadline updated');
  }

  if (Object.keys(updates).length === 0) return ok(epoch);

  try {
    await prisma.$transaction([
      prisma.task.update({ where: { id: subtask.id }, data: updates }),
      prisma.taskActivity.create({
        data: {
          taskId: parent.id,
          actorId: me.id,
          eventType: 'subtask_updated',
          payload: {
            subtaskId: subtask.id,
            name: subtask.name,
            changes: activityChanges,
            ...reassignDetail,
          },
        },
      }),
    ]);

    if (parsed.data.assigneeId && parsed.data.assigneeId !== subtask.ownerId && parsed.data.assigneeId !== me.id) {
      // Effective due date after this update — the payload snapshot must
      // reflect what the assignee will actually see on the subtask.
      const nextDueDate =
        parsed.data.dueDate !== undefined
          ? parsed.data.dueDate
            ? new Date(parsed.data.dueDate)
            : null
          : subtask.dueDate;
      await prisma.notification.create({
        data: {
          userId: parsed.data.assigneeId,
          type: 'task_assigned',
          payload: {
            taskId: subtask.id,
            taskName: subtask.name,
            parentTaskId: parent.id,
            assignedById: me.id,
            assignedByName: me.name ?? null,
            dueDate: nextDueDate?.toISOString() ?? null,
          },
        },
      });
    }
  } catch (err) {
    logError('updateSubtaskAction failed', err);
    return fail('Could not update subtask.', epoch);
  }

  revalidateTask(parent.id);
  return ok(epoch);
}

// ============================================================
// postComment — plus optional status transition
// ============================================================

const postCommentSchema = z.object({
  taskId: z.string().uuid(),
  body: z.string().trim().min(1, 'Comment cannot be empty').max(4000),
  parentCommentId: z.string().uuid().optional(),
});

/**
 * Naive @-mention extraction. Phase 1 keeps it simple: anywhere a
 * `@username` pattern appears in the body, look up the matching user.
 * The mention picker UI (with type-ahead) lands when there are multiple
 * users to pick from.
 */
function extractMentionIds(_body: string): string[] {
  // Phase 1: no synchronous DB lookup here; we'd need to await.
  // Real mention resolution happens in the calling action where we can await.
  return [];
}

async function resolveMentions(body: string): Promise<string[]> {
  const handles = Array.from(body.matchAll(/@([a-z0-9][a-z0-9._-]{1,40})/gi)).map(
    (m) => m[1].toLowerCase(),
  );
  if (handles.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { username: { in: handles } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function postCommentAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const rawParent = formData.get('parentCommentId');
  const parsed = postCommentSchema.safeParse({
    taskId: formData.get('taskId'),
    body: formData.get('body'),
    parentCommentId: rawParent && rawParent !== '' ? String(rawParent) : undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors, epoch };
  }

  const task = await prisma.task.findUnique({
    where: { id: parsed.data.taskId },
    select: { id: true, name: true },
  });
  if (!task) return fail('Task not found.', epoch);

  if (!(await canViewTask(me.id, task.id))) {
    return fail('Task not found.', epoch);
  }

  const mentions = await resolveMentions(parsed.data.body);

  try {
    const comment = await prisma.taskComment.create({
      data: {
        taskId: task.id,
        userId: me.id,
        body: parsed.data.body,
        mentions,
        parentCommentId: parsed.data.parentCommentId ?? null,
      },
    });

    const mentionNotifs = mentions
      .filter((uid) => uid !== me.id)
      .map((uid) => ({
        userId: uid,
        type: 'mention' as const,
        payload: {
          taskId: task.id,
          taskName: task.name,
          commentId: comment.id,
          actorId: me.id,
          actorName: me.name ?? null,
        },
      }));
    if (mentionNotifs.length > 0) {
      await prisma.notification.createMany({ data: mentionNotifs });
    }
  } catch (err) {
    logError('postCommentAction failed', err);
    return fail('Could not post comment.', epoch);
  }

  revalidateTask(task.id);
  return ok(epoch);
}

// ============================================================
// editComment + deleteComment — 5-minute window, own comments only
// ============================================================

const COMMENT_EDIT_WINDOW_MS = 5 * 60 * 1000;

const editCommentSchema = z.object({
  commentId: z.string().uuid(),
  body: z.string().trim().min(1, 'Comment cannot be empty').max(4000),
});

export async function editCommentAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = editCommentSchema.safeParse({
    commentId: formData.get('commentId'),
    body: formData.get('body'),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors, epoch };
  }

  const comment = await prisma.taskComment.findUnique({
    where: { id: parsed.data.commentId },
    select: { id: true, userId: true, taskId: true, createdAt: true },
  });
  if (!comment) return fail('Comment not found.', epoch);
  if (comment.userId !== me.id) return fail('You can only edit your own comments.', epoch);

  const elapsed = Date.now() - comment.createdAt.getTime();
  if (elapsed > COMMENT_EDIT_WINDOW_MS) {
    return fail('Comments can only be edited within 5 minutes of posting.', epoch);
  }

  const mentions = await resolveMentions(parsed.data.body);

  try {
    await prisma.taskComment.update({
      where: { id: comment.id },
      data: {
        body: parsed.data.body,
        mentions,
        editedAt: new Date(),
      },
    });
  } catch (err) {
    logError('editCommentAction failed', err);
    return fail('Could not edit comment.', epoch);
  }

  revalidateTask(comment.taskId);
  return ok(epoch);
}

const deleteCommentSchema = z.object({
  commentId: z.string().uuid(),
});

export async function deleteCommentAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = deleteCommentSchema.safeParse({
    commentId: formData.get('commentId'),
  });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const comment = await prisma.taskComment.findUnique({
    where: { id: parsed.data.commentId },
    select: { id: true, userId: true, taskId: true, createdAt: true },
  });
  if (!comment) return fail('Comment not found.', epoch);
  if (comment.userId !== me.id) return fail('You can only delete your own comments.', epoch);

  const elapsed = Date.now() - comment.createdAt.getTime();
  if (elapsed > COMMENT_EDIT_WINDOW_MS) {
    return fail('Comments can only be deleted within 5 minutes of posting.', epoch);
  }

  try {
    await prisma.taskComment.delete({ where: { id: comment.id } });
  } catch (err) {
    logError('deleteCommentAction failed', err);
    return fail('Could not delete comment.', epoch);
  }

  revalidateTask(comment.taskId);
  return ok(epoch);
}

// ============================================================
// archiveTask + deleteTask (solo-only) + restoreTask
// ============================================================

const taskIdSchema = z.object({ taskId: z.string().uuid() });

export async function archiveTaskAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = taskIdSchema.safeParse({ taskId: formData.get('taskId') });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const task = await prisma.task.findUnique({
    where: { id: parsed.data.taskId },
    select: {
      id: true,
      name: true,
      archivedAt: true,
      ownerId: true,
      createdById: true,
      divisionId: true,
      visibility: true,
    },
  });
  if (!task) return fail('Task not found.', epoch);
  if (task.archivedAt) return ok(epoch);

  // Archiving a task assigned to an individual is a head power: only the
  // head of the task's division, a Super Admin, or a delegate holding that
  // division's power (canActAsHeadOf covers all three). A user may still
  // archive their own personal task, which only they can see.
  const actor = await getRbacActor(me.id);
  const mayArchive =
    (task.visibility === 'personal' && task.ownerId === me.id) ||
    (actor !== null && canActAsHeadOf(actor, task.divisionId));
  if (!mayArchive) {
    return fail(
      'Only a division head, a Super Admin, or a delegated user can archive this task.',
      epoch,
    );
  }

  try {
    await prisma.$transaction([
      prisma.task.update({
        where: { id: task.id },
        data: { archivedAt: new Date(), archivedById: me.id },
      }),
      prisma.taskActivity.create({
        data: { taskId: task.id, actorId: me.id, eventType: 'task_archived', payload: {} },
      }),
      prisma.auditLog.create({
        data: {
          actorId: me.id,
          action: 'archive',
          entityType: 'task',
          entityId: task.id,
          before: { name: task.name, archivedAt: null },
          after: { name: task.name, archivedAt: new Date().toISOString() },
        },
      }),
    ]);
  } catch (err) {
    logError('archiveTaskAction failed', err);
    return fail('Could not archive.', epoch);
  }

  revalidatePath('/tasks');
  return ok(epoch);
}

/**
 * Hard-delete a task (and its subtasks, attachments, and cascading
 * children). Allowed for the owner or creator, a Super Admin (any task),
 * or the head of the task's division — see the permission check below.
 * Everyone else uses Archive (soft-delete) instead.
 */
export async function deleteTaskAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = taskIdSchema.safeParse({ taskId: formData.get('taskId') });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const task = await prisma.task.findUnique({
    where: { id: parsed.data.taskId },
    select: {
      id: true,
      name: true,
      createdById: true,
      ownerId: true,
      divisionId: true,
      visibility: true,
    },
  });
  if (!task) return fail('Task not found.', epoch);

  // Delete rights: a Super Admin (any task) or the head of the task's
  // division (canActAsHeadOf covers both, plus active delegates), and a
  // user for their own personal task. A normal user who merely owns a
  // division task — e.g. after a transfer — can no longer delete it.
  const actor = await getRbacActor(me.id);
  const allowed =
    (task.visibility === 'personal' && task.ownerId === me.id) ||
    (actor !== null && canActAsHeadOf(actor, task.divisionId));
  if (!allowed) {
    return fail(
      'Only a division head or a Super Admin can delete this task.',
      epoch,
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const subtaskIds = (
        await tx.task.findMany({
          where: { parentTaskId: task.id },
          select: { id: true },
        })
      ).map((s) => s.id);

      if (subtaskIds.length > 0) {
        await tx.attachment.deleteMany({
          where: { ownerType: 'task', ownerId: { in: subtaskIds } },
        });
        await tx.task.deleteMany({ where: { parentTaskId: task.id } });
      }

      await tx.attachment.deleteMany({
        where: { ownerType: 'task', ownerId: task.id },
      });
      await tx.task.delete({ where: { id: task.id } });
      await tx.auditLog.create({
        data: {
          actorId: me.id,
          action: 'delete',
          entityType: 'task',
          entityId: task.id,
          before: { name: task.name },
          after: {},
        },
      });
    });
  } catch (err) {
    logError('deleteTaskAction failed', err);
    return fail('Could not delete.', epoch);
  }

  revalidatePath('/tasks');
  return ok(epoch);
}

// ============================================================
// setJsPriorityLane — Phase 2 (OSD-only curation)
// ============================================================

const setJsLaneSchema = z.object({
  taskId: z.string().uuid(),
  lane: z
    .union([
      z.literal('today'),
      z.literal('week'),
      z.literal('month'),
      z.literal('watchlist'),
      z.literal(''),
    ])
    .transform((v) => (v === '' ? null : v)),
});

/**
 * Set / unset a task's JS Priority lane.
 *
 * Permitted: OSD or Super Admin only (per PRD §5.3 "Drag-and-drop … OSD only").
 * Records a `js_priority_changed` activity event + (Phase 2) notifications
 * to the task owner, their Director, and Section Officer.
 */
export async function setJsPriorityLaneAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  // Authorisation: OSD or Super Admin.
  const meRow = await prisma.user.findUnique({
    where: { id: me.id },
    select: { hierarchySlot: true, isSuperAdmin: true },
  });
  if (!meRow) return fail('Account not found.', epoch);
  if (!(meRow.isSuperAdmin || meRow.hierarchySlot === 'osd')) {
    return fail('Only OSD can change JS Priority.', epoch);
  }

  const parsed = setJsLaneSchema.safeParse({
    taskId: formData.get('taskId'),
    lane: formData.get('lane') ?? '',
  });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const task = await prisma.task.findUnique({
    where: { id: parsed.data.taskId },
    select: {
      id: true,
      name: true,
      jsPriorityLane: true,
      ownerId: true,
      owner: { select: { supervisorId: true, divisionId: true } },
    },
  });
  if (!task) return fail('Task not found.', epoch);
  if (task.jsPriorityLane === parsed.data.lane) return ok(epoch);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: task.id },
        data: { jsPriorityLane: parsed.data.lane },
      });
      await tx.taskActivity.create({
        data: {
          taskId: task.id,
          actorId: me.id,
          eventType: 'js_priority_changed',
          payload: { from: task.jsPriorityLane, to: parsed.data.lane },
        },
      });

      if (parsed.data.lane) {
        const notifTargets: string[] = [];
        if (task.ownerId !== me.id) notifTargets.push(task.ownerId);

        if (task.owner.divisionId) {
          const chainOfficers = await tx.user.findMany({
            where: {
              divisionId: task.owner.divisionId,
              hierarchySlot: { in: ['director', 'section_officer'] },
              isActive: true,
              id: { notIn: [me.id, task.ownerId] },
            },
            select: { id: true },
          });
          for (const u of chainOfficers) notifTargets.push(u.id);
        }

        if (notifTargets.length > 0) {
          await tx.notification.createMany({
            data: notifTargets.map((uid) => ({
              userId: uid,
              type: 'js_priority_added',
              payload: {
                taskId: task.id,
                taskName: task.name,
                lane: parsed.data.lane,
                actorId: me.id,
                actorName: me.name ?? null,
              },
            })),
          });
        }
      }
    });
  } catch (err) {
    logError('setJsPriorityLaneAction failed', err);
    return fail('Could not update JS Priority.', epoch);
  }

  revalidatePath('/priority-board');
  revalidateTask(task.id);
  return ok(epoch);
}

// ============================================================
// reorderBoardAction — persist within-lane drag-drop order
// ============================================================

const reorderSchema = z.object({
  lane: z.enum(['today', 'week', 'month', 'watchlist']),
  taskIds: z.array(z.string().uuid()),
});

export async function reorderBoardAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  if (!me.isSuperAdmin && me.hierarchySlot !== 'osd') {
    return fail('Only OSD or Super Admin can reorder the board.', epoch);
  }

  const raw = formData.get('payload');
  if (typeof raw !== 'string') return fail('Invalid input.', epoch);

  let parsed: z.infer<typeof reorderSchema>;
  try {
    parsed = reorderSchema.parse(JSON.parse(raw));
  } catch {
    return fail('Invalid input.', epoch);
  }

  try {
    await prisma.$transaction(
      parsed.taskIds.map((id, i) =>
        prisma.task.updateMany({
          where: { id, jsPriorityLane: parsed.lane },
          data: { jsPrioritySortOrder: i },
        }),
      ),
    );
  } catch (err) {
    logError('reorderBoardAction failed', err);
    return fail('Could not save order.', epoch);
  }

  revalidatePath('/priority-board');
  return ok(epoch);
}

// ============================================================
// addCollaborator / removeCollaborator — Phase 2 cross-division
// ============================================================

const COLLABORATOR_ROLES = ['collaborator', 'division_lead', 'co_owner'] as const;

const addCollaboratorSchema = z.object({
  taskId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(COLLABORATOR_ROLES).default('collaborator'),
});

export async function addCollaboratorAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = addCollaboratorSchema.safeParse({
    taskId: formData.get('taskId'),
    userId: formData.get('userId'),
    role: formData.get('role') ?? 'collaborator',
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors, epoch };
  }

  const task = await prisma.task.findUnique({
    where: { id: parsed.data.taskId },
    select: { id: true, name: true, ownerId: true, createdById: true, divisionId: true, archivedAt: true, dueDate: true },
  });
  if (!task || task.archivedAt) return fail('Task not found.', epoch);

  if (!(await canEditTask(me.id, task))) {
    return fail('You do not have permission to edit this task.', epoch);
  }

  if (parsed.data.userId === task.ownerId) {
    return fail('The task owner is already on the task.', epoch);
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, name: true, isActive: true },
  });
  if (!target || !target.isActive) return fail('User not found or disabled.', epoch);

  // Co-owner cap: max 3 per task.
  if (parsed.data.role === 'co_owner') {
    const coOwnerCount = await prisma.taskCollaborator.count({
      where: { taskId: task.id, role: 'co_owner' },
    });
    if (coOwnerCount >= 3) {
      return fail('A task can have at most 3 co-owners.', epoch);
    }
  }

  try {
    await prisma.taskCollaborator.create({
      data: {
        taskId: task.id,
        userId: parsed.data.userId,
        role: parsed.data.role,
        addedById: me.id,
      },
    });
    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        actorId: me.id,
        eventType: 'collaborator_added',
        payload: {
          userId: parsed.data.userId,
          userName: target.name,
          role: parsed.data.role,
        },
      },
    });
    // Notify the new collaborator.
    if (parsed.data.userId !== me.id) {
      await prisma.notification.create({
        data: {
          userId: parsed.data.userId,
          type: 'task_assigned',
          payload: {
            taskId: task.id,
            taskName: task.name,
            role: parsed.data.role,
            assignedById: me.id,
            assignedByName: me.name ?? null,
            dueDate: task.dueDate?.toISOString() ?? null,
          },
        },
      });
    }
  } catch (err: unknown) {
    // Unique-constraint violation → already a collaborator
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    ) {
      return fail('Already a collaborator on this task.', epoch);
    }
    logError('addCollaboratorAction failed', err);
    return fail('Could not add collaborator.', epoch);
  }

  revalidateTask(task.id);
  return ok(epoch);
}

const removeCollaboratorSchema = z.object({
  taskId: z.string().uuid(),
  userId: z.string().uuid(),
});

export async function removeCollaboratorAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = removeCollaboratorSchema.safeParse({
    taskId: formData.get('taskId'),
    userId: formData.get('userId'),
  });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const task = await prisma.task.findUnique({
    where: { id: parsed.data.taskId },
    select: { id: true, ownerId: true, createdById: true, divisionId: true },
  });
  if (!task) return fail('Task not found.', epoch);

  if (!(await canEditTask(me.id, task))) {
    return fail('You do not have permission to edit this task.', epoch);
  }

  const existing = await prisma.taskCollaborator.findUnique({
    where: {
      taskId_userId: { taskId: parsed.data.taskId, userId: parsed.data.userId },
    },
    include: { user: { select: { name: true } } },
  });
  if (!existing) return ok(epoch);

  try {
    await prisma.taskCollaborator.delete({
      where: {
        taskId_userId: { taskId: parsed.data.taskId, userId: parsed.data.userId },
      },
    });
    await prisma.taskActivity.create({
      data: {
        taskId: parsed.data.taskId,
        actorId: me.id,
        eventType: 'collaborator_removed',
        payload: {
          userId: parsed.data.userId,
          userName: existing.user.name,
          role: existing.role,
        },
      },
    });
  } catch (err) {
    logError('removeCollaboratorAction failed', err);
    return fail('Could not remove collaborator.', epoch);
  }

  revalidateTask(parsed.data.taskId);
  return ok(epoch);
}

// ============================================================
// Reassignment — request + resolve (approve / reject)
// ============================================================

const reassignSchema = z.object({
  taskId: z.string().uuid(),
  newOwnerId: z.string().uuid(),
});

async function isSubordinateOf(userId: string, superiorId: string): Promise<boolean> {
  let current = userId;
  for (let depth = 0; depth < 20; depth++) {
    const user = await prisma.user.findUnique({
      where: { id: current },
      select: { supervisorId: true },
    });
    if (!user?.supervisorId) return false;
    if (user.supervisorId === superiorId) return true;
    current = user.supervisorId;
  }
  return false;
}

export async function reassignTaskAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = reassignSchema.safeParse({
    taskId: formData.get('taskId'),
    newOwnerId: formData.get('newOwnerId'),
  });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const task = await prisma.task.findUnique({
    where: { id: parsed.data.taskId },
    select: { id: true, name: true, ownerId: true, createdById: true, divisionId: true, dueDate: true },
  });
  if (!task) return fail('Task not found.', epoch);
  if (task.ownerId === parsed.data.newOwnerId) return fail('Already the owner.', epoch);

  const newOwner = await prisma.user.findUnique({
    where: { id: parsed.data.newOwnerId, isActive: true },
    select: { id: true, name: true },
  });
  if (!newOwner) return fail('User not found.', epoch);

  const meRow = await prisma.user.findUnique({
    where: { id: me.id },
    select: { id: true, supervisorId: true, isSuperAdmin: true, hierarchySlot: true },
  });
  if (!meRow) return fail('User not found.', epoch);

  const [actor, targetRbac] = await Promise.all([
    getRbacActor(me.id),
    getRbacTarget(parsed.data.newOwnerId),
  ]);
  if (!actor || !targetRbac) return fail('User not found.', epoch);

  // Initiation guard: reassigning the owner from the Owner row is a head
  // power — Super Admin, OSD, or the head of the task's division only.
  // Everyone else (including the owner) hands the task off via Transfer
  // task, which requires a comment. Matches the surface the UI shows.
  const mayInitiate =
    meRow.isSuperAdmin ||
    meRow.hierarchySlot === 'osd' ||
    canActAsHeadOf(actor, task.divisionId);
  if (!mayInitiate) {
    return fail('Only a division head or Super Admin can reassign the owner here. Use Transfer task instead.', epoch);
  }

  const isDownward = await isSubordinateOf(parsed.data.newOwnerId, me.id);
  // Free (no approval): Super Admin / OSD anywhere; downward within own
  // chain (existing hierarchy rule); a Division Head assigning the tasks
  // of a division they head to users within their division scope.
  const isFree =
    isDownward ||
    meRow.isSuperAdmin ||
    meRow.hierarchySlot === 'osd' ||
    (canActAsHeadOf(actor, task.divisionId) && canAssignTaskTo(actor, targetRbac));

  if (!isFree && !canTransferTaskTo(actor, targetRbac)) {
    // Approval requests must still stay inside the transfer matrix —
    // no proposing owners across division lines.
    return fail(
      'You can reassign within your division, to your division head, or to Super Admin.',
      epoch,
    );
  }

  try {
    if (isFree) {
      await prisma.$transaction([
        prisma.task.update({
          where: { id: task.id },
          data: { ownerId: parsed.data.newOwnerId },
        }),
        prisma.taskActivity.create({
          data: {
            taskId: task.id,
            actorId: me.id,
            eventType: 'owner_changed',
            payload: { from: task.ownerId, to: parsed.data.newOwnerId, toName: newOwner.name },
          },
        }),
      ]);
      if (parsed.data.newOwnerId !== me.id) {
        await prisma.notification.create({
          data: {
            userId: parsed.data.newOwnerId,
            type: 'task_assigned',
            payload: {
              taskId: task.id,
              taskName: task.name,
              actorId: me.id,
              assignedById: me.id,
              assignedByName: me.name ?? null,
              dueDate: task.dueDate?.toISOString() ?? null,
            },
          },
        });
      }
    } else {
      const approverId = meRow.supervisorId;
      if (!approverId) return fail('No supervisor found to approve this reassignment.', epoch);

      const existing = await prisma.reassignmentRequest.findFirst({
        where: { taskId: task.id, status: 'pending' },
      });
      if (existing) return fail('A reassignment is already pending approval.', epoch);

      await prisma.reassignmentRequest.create({
        data: {
          taskId: task.id,
          requestedById: me.id,
          proposedOwnerId: parsed.data.newOwnerId,
          approverId,
        },
      });
      await prisma.notification.create({
        data: {
          userId: approverId,
          type: 'reassignment_approval_requested',
          payload: {
            taskId: task.id,
            taskName: task.name,
            actorId: me.id,
            actorName: me.name ?? null,
            proposedOwnerId: parsed.data.newOwnerId,
          },
        },
      });
      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          actorId: me.id,
          eventType: 'reassignment_requested',
          payload: { proposedOwnerId: parsed.data.newOwnerId, proposedOwnerName: newOwner.name },
        },
      });
    }
  } catch (err) {
    logError('reassignTaskAction failed', err);
    return fail('Could not reassign task.', epoch);
  }

  revalidateTask(task.id);
  return ok(epoch);
}

const resolveReassignmentSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
});

export async function resolveReassignmentAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = resolveReassignmentSchema.safeParse({
    requestId: formData.get('requestId'),
    action: formData.get('action'),
  });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const request = await prisma.reassignmentRequest.findUnique({
    where: { id: parsed.data.requestId },
    include: {
      task: { select: { id: true, name: true, ownerId: true, dueDate: true } },
      proposedOwner: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true } },
    },
  });
  if (!request) return fail('Request not found.', epoch);
  if (request.status !== 'pending') return fail('This request has already been resolved.', epoch);
  if (request.approverId !== me.id) return fail('You are not the approver for this request.', epoch);

  const approved = parsed.data.action === 'approve';

  const claimed = await prisma.reassignmentRequest.updateMany({
    where: { id: request.id, status: 'pending' },
    data: { status: approved ? 'approved' : 'rejected', resolvedAt: new Date() },
  });
  if (claimed.count === 0) return fail('This request has already been resolved.', epoch);

  if (approved) {
    await prisma.$transaction([
      prisma.task.update({
        where: { id: request.taskId },
        data: { ownerId: request.proposedOwnerId },
      }),
      prisma.taskActivity.create({
        data: {
          taskId: request.taskId,
          actorId: me.id,
          eventType: 'owner_changed',
          payload: {
            from: request.task.ownerId,
            to: request.proposedOwnerId,
            toName: request.proposedOwner.name,
            viaApproval: true,
          },
        },
      }),
    ]);
    await prisma.notification.createMany({
      data: [
        {
          userId: request.requestedById,
          type: 'reassignment_approved',
          payload: {
            taskId: request.taskId,
            taskName: request.task.name,
            actorId: me.id,
            actorName: me.name ?? null,
          },
        },
        ...(request.proposedOwnerId !== request.requestedById
          ? [{
              userId: request.proposedOwnerId,
              type: 'task_assigned' as const,
              payload: {
                taskId: request.taskId,
                taskName: request.task.name,
                actorId: me.id,
                assignedById: request.requestedById,
                assignedByName: request.requestedBy.name,
                dueDate: request.task.dueDate?.toISOString() ?? null,
              },
            }]
          : []),
      ],
    });
  } else {
    await prisma.taskActivity.create({
      data: {
        taskId: request.taskId,
        actorId: me.id,
        eventType: 'reassignment_rejected',
        payload: { proposedOwnerId: request.proposedOwnerId, proposedOwnerName: request.proposedOwner.name },
      },
    });
    await prisma.notification.create({
      data: {
        userId: request.requestedById,
        type: 'reassignment_rejected',
        payload: {
          taskId: request.taskId,
          taskName: request.task.name,
          actorId: me.id,
          actorName: me.name ?? null,
        },
      },
    });
  }

  revalidateTask(request.taskId);
  return ok(epoch);
}

// ============================================================
// transferTask — owner hands the task off per the RBAC transfer matrix
// ============================================================

/**
 * Allowed targets (enforced in `canTransferTaskTo`, src/lib/rbac/rules.ts):
 *   Super Admin   → anyone
 *   Division Head → own division(s), another Division Head, Super Admin
 *   Division User → own division, their Division Head, Super Admin
 * A comment is mandatory on every transfer. The full trail lands in
 * task_activity (with the comment), the comment thread, and audit_log.
 */
const transferTaskSchema = z.object({
  taskId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  comment: z
    .string()
    .trim()
    .min(1, 'A comment is required to transfer a task')
    .max(2000, 'Comment is too long'),
});

export async function transferTaskAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out. Refresh and try again.', epoch);

  const parsed = transferTaskSchema.safeParse({
    taskId: formData.get('taskId'),
    targetUserId: formData.get('targetUserId'),
    comment: formData.get('comment'),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, error: fieldErrors.comment, fieldErrors, epoch };
  }

  const task = await prisma.task.findUnique({
    where: { id: parsed.data.taskId },
    select: { id: true, name: true, ownerId: true, createdById: true, divisionId: true, visibility: true, dueDate: true },
  });
  if (!task) return fail('Task not found.', epoch);

  if (task.ownerId !== me.id) return fail('Only the current owner can transfer a task.', epoch);

  if (parsed.data.targetUserId === me.id) return fail('You already own this task.', epoch);

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.targetUserId },
    select: { id: true, name: true, isActive: true, divisionId: true },
  });
  if (!target || !target.isActive) return fail('Target user not found or inactive.', epoch);

  const [actor, targetRbac] = await Promise.all([
    getRbacActor(me.id),
    getRbacTarget(target.id),
  ]);
  if (!actor) return fail('Your account could not be found.', epoch);
  if (!targetRbac || !canTransferTaskTo(actor, targetRbac)) {
    return fail(
      'You can transfer within your division, to your division head, or to Super Admin.',
      epoch,
    );
  }

  const comment = parsed.data.comment;
  const mentions = await resolveMentions(comment);

  const updates: Parameters<typeof prisma.task.update>[0]['data'] = {
    ownerId: target.id,
  };
  if (task.visibility === 'personal') {
    if (canCreateDivisionTask(actor, task.divisionId)) {
      updates.visibility = 'division';
    }
  }

  try {
    await prisma.$transaction([
      prisma.task.update({ where: { id: task.id }, data: updates }),
      prisma.taskActivity.create({
        data: {
          taskId: task.id,
          actorId: me.id,
          eventType: 'task_transferred',
          payload: {
            from: me.id,
            fromName: me.name,
            to: target.id,
            toName: target.name,
            comment,
          },
        },
      }),
      // The mandatory transfer note joins the comment thread so the
      // hand-off reason is visible where the discussion lives.
      prisma.taskComment.create({
        data: {
          taskId: task.id,
          userId: me.id,
          body: comment,
          mentions,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: me.id,
          action: 'update',
          entityType: 'task',
          entityId: task.id,
          before: { ownerId: task.ownerId },
          after: { ownerId: target.id, transfer: true, comment },
        },
      }),
    ]);
  } catch (err) {
    logError('transferTaskAction failed', err);
    return fail('Could not transfer the task.', epoch);
  }

  const notifications = [
    prisma.notification.create({
      data: {
        userId: target.id,
        type: 'task_assigned',
        payload: {
          taskId: task.id,
          taskName: task.name,
          assignedById: me.id,
          assignedByName: me.name ?? null,
          dueDate: task.dueDate?.toISOString() ?? null,
          comment,
        },
      },
    }),
  ];

  if (task.createdById !== me.id && task.createdById !== target.id) {
    notifications.push(
      prisma.notification.create({
        data: {
          userId: task.createdById,
          type: 'task_transferred',
          payload: { taskId: task.id, taskName: task.name, fromName: me.name, toName: target.name, comment },
        },
      }),
    );
  }

  await Promise.all(notifications);

  revalidateTask(task.id);
  return ok(epoch);
}

// ---------------------------------------------------------------
// Pull task — division user claims an unassigned task
// ---------------------------------------------------------------

const pullTaskSchema = z.object({ taskId: z.string().uuid() });

export async function pullTaskAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = pullTaskSchema.safeParse({ taskId: formData.get('taskId') });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const task = await prisma.task.findUnique({
    where: { id: parsed.data.taskId },
    select: { id: true, name: true, ownerId: true, createdById: true, divisionId: true, visibility: true, parentTaskId: true },
  });
  if (!task) return fail('Task not found.', epoch);

  if (task.ownerId !== task.createdById) return fail('This task is already assigned.', epoch);
  if (task.ownerId === me.id) return fail('You already own this task.', epoch);
  if (task.visibility === 'personal') return fail('Personal tasks cannot be pulled.', epoch);
  if (task.parentTaskId) return fail('Subtasks cannot be pulled.', epoch);

  const meRow = await prisma.user.findUnique({
    where: { id: me.id },
    select: { id: true, name: true, divisionId: true },
  });
  if (!meRow) return fail('User not found.', epoch);
  if (meRow.divisionId !== task.divisionId) return fail('You can only pull tasks from your own division.', epoch);

  await prisma.$transaction([
    prisma.task.update({
      where: { id: task.id },
      data: { ownerId: me.id },
    }),
    prisma.taskActivity.create({
      data: {
        taskId: task.id,
        actorId: me.id,
        eventType: 'task_pulled',
        payload: { pulledBy: me.id, pulledByName: meRow.name },
      },
    }),
  ]);

  if (task.createdById !== me.id) {
    await prisma.notification.create({
      data: {
        userId: task.createdById,
        type: 'task_pulled',
        payload: { taskId: task.id, taskName: task.name, pulledByName: meRow.name },
      },
    });
  }

  revalidateTask(task.id);
  return ok(epoch);
}
