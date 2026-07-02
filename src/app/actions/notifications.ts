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

  const claimed = await prisma.notification.updateMany({
    where: {
      id: parsed.data.id,
      userId: session.user.id,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  // Swipe-to-mark-read counts as reading the task — same receipt as opening.
  if (claimed.count > 0) {
    await recordTaskReadReceipt(parsed.data.id, session.user.id);
  }

  revalidatePath('/notifications');
  revalidatePath('/tasks');
  return { ok: true, epoch };
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  // Capture unread assignment notifications before flipping readAt — they
  // drive the read receipts written to each task's activity trail.
  const unreadAssignments = await prisma.notification.findMany({
    where: { userId: session.user.id, readAt: null, type: 'task_assigned' },
    select: { id: true, payload: true },
    orderBy: { createdAt: 'asc' },
  });

  const marked = await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  if (marked.count > 0 && unreadAssignments.length > 0) {
    await recordTaskReadReceiptsBulk(unreadAssignments, session.user.id);
  }

  revalidatePath('/notifications');
  revalidatePath('/tasks');
}

/**
 * Form action used by notification rows: marks the row read AND redirects
 * to the linked entity in one round-trip.
 *
 * Read receipt: the first time a task-assignment notification is marked
 * read — by opening it, swiping it read, or "Mark all read" — a `task_read`
 * event is written to that task's activity trail so the assigner and owner
 * can see who read the task and when. The updateMany with `readAt: null`
 * is the atomic claim — an already-read notification never logs a second
 * receipt.
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

/**
 * Bulk variant for "Mark all read": one receipt per distinct task across
 * the batch (several unread notifications for the same task collapse into
 * a single `task_read` row). Tasks deleted since notification are skipped.
 */
async function recordTaskReadReceiptsBulk(
  notifications: { id: string; payload: unknown }[],
  readerId: string,
): Promise<void> {
  try {
    // taskId → the first notification that referenced it.
    const taskNotification = new Map<string, string>();
    for (const n of notifications) {
      const payload = (n.payload ?? {}) as Record<string, unknown>;
      const taskId =
        typeof payload.taskId === 'string' && UUID_RE.test(payload.taskId)
          ? payload.taskId
          : null;
      if (taskId && !taskNotification.has(taskId)) {
        taskNotification.set(taskId, n.id);
      }
    }
    if (taskNotification.size === 0) return;

    const tasks = await prisma.task.findMany({
      where: { id: { in: [...taskNotification.keys()] } },
      select: { id: true, name: true, parentTaskId: true },
    });
    if (tasks.length === 0) return;

    const rows: {
      taskId: string;
      actorId: string;
      eventType: string;
      payload: { notificationId: string; subtaskId?: string; subtaskName?: string };
    }[] = [];
    for (const task of tasks) {
      const notificationId = taskNotification.get(task.id) as string;
      rows.push({
        taskId: task.id,
        actorId: readerId,
        eventType: 'task_read',
        payload: { notificationId },
      });
      if (task.parentTaskId) {
        rows.push({
          taskId: task.parentTaskId,
          actorId: readerId,
          eventType: 'subtask_read',
          payload: { subtaskId: task.id, subtaskName: task.name, notificationId },
        });
      }
    }
    await prisma.taskActivity.createMany({ data: rows });

    const paths = new Set<string>();
    for (const row of rows) paths.add(`/tasks/${row.taskId}`);
    for (const path of paths) revalidatePath(path);
  } catch (err) {
    // A failed receipt must never block marking notifications read.
    console.error('recordTaskReadReceiptsBulk failed:', err);
  }
}
