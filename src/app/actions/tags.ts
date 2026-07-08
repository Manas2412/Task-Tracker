'use server';
import { logError } from '@/lib/utils/log';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Tag actions (Phase 3 — final).
 *
 *   - createTagAction / renameTagAction / deleteTagAction → Super Admin only
 *   - addTagToTaskAction / removeTagFromTaskAction → Super Admin only
 *
 * Tag CRUD writes audit_log entries. Task-tag assignments write per-task
 * activity (user-facing) but skip audit_log to keep that log focused on
 * structural changes.
 */

type ActionState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  epoch?: number;
  id?: string;
};

function bump(prev: ActionState | undefined): number {
  return (prev?.epoch ?? 0) + 1;
}
function fail(message: string, epoch: number, fieldErrors?: Record<string, string>): ActionState {
  return { ok: false, error: message, epoch, fieldErrors };
}
function ok(epoch: number, extra?: Partial<ActionState>): ActionState {
  return { ok: true, epoch, ...extra };
}

async function requireSession() {
  const session = await auth();
  if (!session?.user) return null;
  return session.user;
}

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: 'You are signed out.' };
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSuperAdmin: true, isActive: true },
  });
  if (!me?.isActive) return { ok: false as const, error: 'Your account is unavailable.' };
  if (!me.isSuperAdmin) return { ok: false as const, error: 'Super Admin access is required.' };
  return { ok: true as const, userId: session.user.id };
}

// ============================================================
// CRUD — Super Admin
// ============================================================

const nameSchema = z.string().trim().min(1, 'Name is required').max(40, 'Name is too long');

const createSchema = z.object({ name: nameSchema });

export async function createTagAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const guard = await requireSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  const parsed = createSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) {
    return { ok: false, fieldErrors: { name: parsed.error.issues[0]?.message ?? 'Invalid' }, epoch };
  }

  const existing = await prisma.tag.findUnique({
    where: { name: parsed.data.name },
    select: { id: true },
  });
  if (existing) return { ok: false, fieldErrors: { name: 'Tag already exists' }, epoch };

  try {
    const tag = await prisma.tag.create({
      data: { name: parsed.data.name, createdById: guard.userId },
    });
    await prisma.auditLog.create({
      data: {
        actorId: guard.userId,
        action: 'create',
        entityType: 'tag',
        entityId: tag.id,
        before: {},
        after: { name: tag.name },
      },
    });
    revalidatePath('/admin/tags');
    return ok(epoch, { id: tag.id });
  } catch (err) {
    logError('createTagAction failed', err);
    return fail('Could not create the tag.', epoch);
  }
}

const renameSchema = z.object({
  id: z.string().uuid(),
  name: nameSchema,
});

export async function renameTagAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const guard = await requireSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  const parsed = renameSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: { name: parsed.error.issues[0]?.message ?? 'Invalid' }, epoch };
  }

  const before = await prisma.tag.findUnique({
    where: { id: parsed.data.id },
    select: { name: true },
  });
  if (!before) return fail('Tag not found.', epoch);
  if (before.name === parsed.data.name) return ok(epoch);

  const clash = await prisma.tag.findUnique({
    where: { name: parsed.data.name },
    select: { id: true },
  });
  if (clash) return { ok: false, fieldErrors: { name: 'A tag with that name already exists' }, epoch };

  try {
    await prisma.tag.update({
      where: { id: parsed.data.id },
      data: { name: parsed.data.name },
    });
    await prisma.auditLog.create({
      data: {
        actorId: guard.userId,
        action: 'update',
        entityType: 'tag',
        entityId: parsed.data.id,
        before: { name: before.name },
        after: { name: parsed.data.name },
      },
    });
    revalidatePath('/admin/tags');
    return ok(epoch);
  } catch (err) {
    logError('renameTagAction failed', err);
    return fail('Could not rename.', epoch);
  }
}

const idSchema = z.object({ id: z.string().uuid() });

export async function deleteTagAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const guard = await requireSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const tag = await prisma.tag.findUnique({
    where: { id: parsed.data.id },
    select: { name: true, _count: { select: { tasks: true } } },
  });
  if (!tag) return fail('Tag not found.', epoch);
  if (tag._count.tasks > 0) {
    return fail(
      `This tag is on ${tag._count.tasks} ${tag._count.tasks === 1 ? 'task' : 'tasks'}. Remove it from each first.`,
      epoch,
    );
  }

  try {
    await prisma.tag.delete({ where: { id: parsed.data.id } });
    await prisma.auditLog.create({
      data: {
        actorId: guard.userId,
        action: 'delete',
        entityType: 'tag',
        entityId: parsed.data.id,
        before: { name: tag.name },
        after: {},
      },
    });
    revalidatePath('/admin/tags');
    return ok(epoch);
  } catch (err) {
    logError('deleteTagAction failed', err);
    return fail('Could not delete.', epoch);
  }
}

// ============================================================
// Assignment — Super Admin only (tags are a Super Admin feature)
// ============================================================

function canManageTaskTags(me: { isSuperAdmin: boolean }): boolean {
  return me.isSuperAdmin;
}

const assignSchema = z.object({
  taskId: z.string().uuid(),
  tagId: z.string().uuid(),
});

export async function addTagToTaskAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = assignSchema.safeParse({
    taskId: formData.get('taskId'),
    tagId: formData.get('tagId'),
  });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const task = await prisma.task.findUnique({
    where: { id: parsed.data.taskId },
    select: { id: true, ownerId: true, createdById: true, divisionId: true },
  });
  if (!task) return fail('Task not found.', epoch);

  if (!canManageTaskTags(me)) {
    return fail('Only a Super Admin can tag a task.', epoch);
  }

  const tag = await prisma.tag.findUnique({
    where: { id: parsed.data.tagId },
    select: { id: true, name: true },
  });
  if (!tag) return fail('Tag not found.', epoch);

  try {
    await prisma.taskTag.create({
      data: { taskId: task.id, tagId: tag.id },
    });
    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        actorId: me.id,
        eventType: 'tag_added',
        payload: { tagId: tag.id, tagName: tag.name },
      },
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    ) {
      return ok(epoch); // already added
    }
    logError('addTagToTaskAction failed', err);
    return fail('Could not add the tag.', epoch);
  }

  revalidatePath(`/tasks/${task.id}`);
  return ok(epoch);
}

export async function removeTagFromTaskAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = assignSchema.safeParse({
    taskId: formData.get('taskId'),
    tagId: formData.get('tagId'),
  });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const task = await prisma.task.findUnique({
    where: { id: parsed.data.taskId },
    select: { id: true, ownerId: true, createdById: true, divisionId: true },
  });
  if (!task) return fail('Task not found.', epoch);

  if (!canManageTaskTags(me)) {
    return fail('Only a Super Admin can edit tags on a task.', epoch);
  }

  const tag = await prisma.tag.findUnique({
    where: { id: parsed.data.tagId },
    select: { name: true },
  });

  try {
    await prisma.taskTag.delete({
      where: { taskId_tagId: { taskId: task.id, tagId: parsed.data.tagId } },
    });
    if (tag) {
      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          actorId: me.id,
          eventType: 'tag_removed',
          payload: { tagId: parsed.data.tagId, tagName: tag.name },
        },
      });
    }
  } catch (err) {
    logError('removeTagFromTaskAction failed', err);
    return fail('Could not remove the tag.', epoch);
  }

  revalidatePath(`/tasks/${task.id}`);
  return ok(epoch);
}
