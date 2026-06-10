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
 */
export async function readAndRedirectAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const id = String(formData.get('id') ?? '');
  const href = String(formData.get('href') ?? '/notifications');

  if (id && /^[0-9a-f-]{36}$/i.test(id)) {
    await prisma.notification.updateMany({
      where: { id, userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  redirect(href);
}
