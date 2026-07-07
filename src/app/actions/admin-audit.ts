'use server';
import { logError } from '@/lib/utils/log';

import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Super Admin bulk-clear actions, surfaced on the Audit Trail page.
 *
 * These wipe the user-facing NOTIFICATIONS and per-entity ACTIVITY trails
 * system-wide. They deliberately do NOT touch `audit_log` — that table is
 * the immutable audit trail itself (and each clear writes a summary row to
 * it). Super Admin only, irreversible; each clear is recorded once.
 */

/** Placeholder entity id for a system-wide event (mirrors bulk-import). */
const SYSTEM_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

export type BulkClearState = {
  ok: boolean;
  error?: string;
  epoch?: number;
  /** How many rows were deleted, for the success message. */
  count?: number;
};

function bump(prev: BulkClearState | undefined): number {
  return (prev?.epoch ?? 0) + 1;
}

function fail(message: string, epoch: number): BulkClearState {
  return { ok: false, error: message, epoch };
}

async function requireSuperAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: 'You are signed out.' };
  // Re-check from the DB, never the JWT — a demoted admin must lose access
  // immediately for an action this destructive.
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSuperAdmin: true, isActive: true },
  });
  if (!me?.isActive) return { ok: false, error: 'Your account is disabled.' };
  if (!me.isSuperAdmin) return { ok: false, error: 'Super Admin access is required.' };
  return { ok: true, userId: session.user.id };
}

/**
 * Permanently delete every notification for every user, system-wide.
 */
export async function clearAllNotificationsForAllUsersAction(
  prev: BulkClearState | undefined,
  _formData: FormData,
): Promise<BulkClearState> {
  const epoch = bump(prev);
  const guard = await requireSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  try {
    const count = await prisma.$transaction(
      async (tx) => {
        const del = await tx.notification.deleteMany({});
        await tx.auditLog.create({
          data: {
            actorId: guard.userId,
            action: 'delete',
            entityType: 'system',
            entityId: SYSTEM_ENTITY_ID,
            before: {},
            after: { event: 'clear_all_notifications', deletedCount: del.count },
          },
        });
        return del.count;
      },
      { timeout: 60_000 },
    );

    revalidatePath('/admin/audit');
    revalidatePath('/notifications');
    return { ok: true, epoch, count };
  } catch (err) {
    logError('clearAllNotificationsForAllUsersAction failed', err);
    return fail('Could not clear notifications.', epoch);
  }
}

/**
 * Permanently delete every per-task and per-Timeline-File activity event,
 * system-wide. Clears the "Activity" sections on task / TF detail pages —
 * NOT the audit_log shown on this page.
 */
export async function clearAllActivityTrailsAction(
  prev: BulkClearState | undefined,
  _formData: FormData,
): Promise<BulkClearState> {
  const epoch = bump(prev);
  const guard = await requireSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  try {
    const count = await prisma.$transaction(
      async (tx) => {
        const taskAct = await tx.taskActivity.deleteMany({});
        const tfAct = await tx.timelineFileActivity.deleteMany({});
        await tx.auditLog.create({
          data: {
            actorId: guard.userId,
            action: 'delete',
            entityType: 'system',
            entityId: SYSTEM_ENTITY_ID,
            before: {},
            after: {
              event: 'clear_all_activity',
              taskActivityDeleted: taskAct.count,
              timelineFileActivityDeleted: tfAct.count,
            },
          },
        });
        return taskAct.count + tfAct.count;
      },
      { timeout: 60_000 },
    );

    revalidatePath('/admin/audit');
    revalidatePath('/tasks');
    revalidatePath('/timeline-files');
    return { ok: true, epoch, count };
  } catch (err) {
    logError('clearAllActivityTrailsAction failed', err);
    return fail('Could not clear activity trails.', epoch);
  }
}
