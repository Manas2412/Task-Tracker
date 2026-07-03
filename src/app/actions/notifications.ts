'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Notification actions.
 *
 * Every action is scoped to the caller's own notifications — a user can
 * never read or mark someone else's. Server-side `where: { userId, ... }`
 * is the enforcement; no client-side check is trusted.
 */

const markReadSchema = z.object({ id: z.string().uuid() });

export async function markNotificationReadAction(
  prev: { ok: boolean; epoch?: number } | undefined,
  formData: FormData,
): Promise<{ ok: boolean; epoch?: number }> {
  const epoch = (prev?.epoch ?? 0) + 1;
  const session = await auth();
  if (!session?.user) return { ok: false, epoch };

  const parsed = markReadSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return { ok: false, epoch };

  await prisma.notification.updateMany({
    where: {
      id: parsed.data.id,
      userId: session.user.id,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  revalidatePath('/notifications');
  revalidatePath('/tasks');
  return { ok: true, epoch };
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath('/notifications');
  revalidatePath('/tasks');
}

/**
 * Form action used by notification rows: marks the row read AND redirects
 * to the linked entity in one round-trip.
 *
 * Read receipt: the first time a user opens a task-assignment notification,
 * a `task_read` event is written to that task's activity trail so the
 * assigner and owner can see who read the task and when. The updateMany
 * with `readAt: null` is the atomic claim — a re-opened (already read)
 * notification never logs a second receipt.
 */
export async function readAndRedirectAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const id = String(formData.get('id') ?? '');
  const href = String(formData.get('href') ?? '/notifications');

  if (id && /^[0-9a-f-]{36}$/i.test(id)) {
    const claimed = await prisma.notification.updateMany({
      where: { id, userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });

    if (claimed.count > 0) {
      await recordTaskReadReceipt(id, session.user.id);
    }
  }

  redirect(href);
}

const UUID_RE = /^[0-9a-f-]{36}$/i;

async function recordTaskReadReceipt(notificationId: string, readerId: string): Promise<void> {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId: readerId, type: 'task_assigned' },
      select: { payload: true },
    });
    if (!notification) return;

    const payload = (notification.payload ?? {}) as Record<string, unknown>;
    const taskId =
      typeof payload.taskId === 'string' && UUID_RE.test(payload.taskId) ? payload.taskId : null;
    if (!taskId) return;

    // The task may have been deleted since the notification was sent.
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, name: true, parentTaskId: true },
    });
    if (!task) return;

    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        actorId: readerId,
        eventType: 'task_read',
        payload: { notificationId },
      },
    });
    revalidatePath(`/tasks/${task.id}`);

    // Subtask assignments are managed from the parent's detail page, so the
    // read receipt is mirrored there — that is where the assigner looks.
    if (task.parentTaskId) {
      await prisma.taskActivity.create({
        data: {
          taskId: task.parentTaskId,
          actorId: readerId,
          eventType: 'subtask_read',
          payload: { subtaskId: task.id, subtaskName: task.name, notificationId },
        },
      });
      revalidatePath(`/tasks/${task.parentTaskId}`);
    }
  } catch (err) {
    // A failed receipt must never block navigation to the task.
    console.error('recordTaskReadReceipt failed:', err);
  }
}
