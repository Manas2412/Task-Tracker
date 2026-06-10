'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { nextRefNumber } from '@/lib/timeline-files';

/**
 * Timeline File server actions (PRD §5.2).
 *
 *   createTimelineFileAction       — auto-generates TF-YYYY/NNN, atomic
 *   updateTimelineFileFieldsAction — subject/from/dates/secretary's comments
 *   updateTimelineFileStatusAction — Pending Action / In Progress / etc.
 *   addMarkedToAction / removeMarkedToAction — division scope membership
 *
 * Authorisation:
 *   - Creation: OSD or Super Admin (delegation to staff lands later)
 *   - Edits to subject/from/dates/secretary comments: OSD + Super Admin
 *   - Status change: OSD + Super Admin + Director of any marked-to division
 *   - Phase 3 simplification: action-level checks; row-level visibility
 *     enforced by the scoper used for reads.
 */

// ============================================================
// Shared
// ============================================================

type ActionState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  epoch?: number;
  id?: string;
  refNo?: string;
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

async function requireOsdOrSuperAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const me = await requireSession();
  if (!me) return { ok: false, error: 'You are signed out.' };
  if (me.isSuperAdmin || me.hierarchySlot === 'osd') {
    return { ok: true, userId: me.id };
  }
  return { ok: false, error: 'Only OSD can do that.' };
}

function revalidateTf(tfId?: string) {
  revalidatePath('/timeline-files');
  if (tfId) revalidatePath(`/timeline-files/${tfId}`);
}

const TF_STATUSES = [
  'pending_action',
  'in_progress',
  'awaiting_reply',
  'on_hold',
  'closed',
] as const;

// ============================================================
// createTimelineFileAction
// ============================================================

const createSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(200, 'Subject is too long'),
  fromWhom: z.string().trim().min(1, 'From-whom is required').max(120),
  receivedDate: z
    .string()
    .min(1, 'Received date is required')
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Received date is invalid'),
  deadlineDate: z
    .string()
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined))
    .refine((s) => !s || !Number.isNaN(Date.parse(s)), 'Deadline date is invalid'),
  secretaryComments: z
    .string()
    .max(4000)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined)),
  /** Comma-separated UUIDs of divisions the file is marked to. */
  markedTo: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').filter(Boolean) : []))
    .pipe(z.array(z.string().uuid()).min(1, 'Mark to at least one division')),
});

export async function createTimelineFileAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const guard = await requireOsdOrSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  const parsed = createSchema.safeParse({
    subject: formData.get('subject'),
    fromWhom: formData.get('fromWhom'),
    receivedDate: formData.get('receivedDate'),
    deadlineDate: formData.get('deadlineDate'),
    secretaryComments: formData.get('secretaryComments'),
    markedTo: formData.get('markedTo'),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors, epoch };
  }

  const received = new Date(parsed.data.receivedDate);
  const deadline = parsed.data.deadlineDate ? new Date(parsed.data.deadlineDate) : null;
  const refYearGuess = received.getUTCFullYear();

  // Up to 3 retries against the unique(ref_year, ref_seq) constraint
  // under burst-create.
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const { refNo, refYear, refSeq } = await nextRefNumber(tx, refYearGuess);
        return tx.timelineFile.create({
          data: {
            refNo,
            refYear,
            refSeq,
            subject: parsed.data.subject,
            fromWhom: parsed.data.fromWhom,
            receivedDate: received,
            deadlineDate: deadline,
            status: 'pending_action',
            secretaryComments: parsed.data.secretaryComments ?? null,
            createdById: guard.userId,
            markedTo: {
              createMany: {
                data: parsed.data.markedTo.map((divisionId) => ({ divisionId })),
              },
            },
          },
        });
      });

      // Notify each marked-to division's Director (best-effort).
      const directors = await prisma.user.findMany({
        where: {
          divisionId: { in: parsed.data.markedTo },
          hierarchySlot: 'director',
          isActive: true,
        },
        select: { id: true },
      });
      if (directors.length > 0) {
        await prisma.notification.createMany({
          data: directors.map((d) => ({
            userId: d.id,
            type: 'timeline_file_marked_to_division',
            payload: { timelineFileId: created.id, refNo: created.refNo },
          })),
        });
      }

      await prisma.timelineFileActivity.create({
        data: {
          timelineFileId: created.id,
          actorId: guard.userId,
          eventType: 'created_from_correspondence',
          payload: {
            subject: created.subject,
            fromWhom: created.fromWhom,
            markedToCount: parsed.data.markedTo.length,
          },
        },
      });

      revalidateTf(created.id);
      return ok(epoch, { id: created.id, refNo: created.refNo });
    } catch (err: unknown) {
      // P2002 = unique constraint violation. Re-loop to grab the next NNN.
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: string }).code === 'P2002' &&
        attempt < MAX_ATTEMPTS
      ) {
        continue;
      }
      console.error('createTimelineFileAction failed:', err);
      return fail('Could not create the timeline file. Try again.', epoch);
    }
  }
  return fail('Reference number conflict. Try again.', epoch);
}

// ============================================================
// updateTimelineFileStatusAction
// ============================================================

const updateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(TF_STATUSES),
});

export async function updateTimelineFileStatusAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = updateStatusSchema.safeParse({
    id: formData.get('id'),
    status: formData.get('status'),
  });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const tf = await prisma.timelineFile.findUnique({
    where: { id: parsed.data.id },
    include: { markedTo: { select: { divisionId: true } } },
  });
  if (!tf) return fail('Timeline file not found.', epoch);
  if (tf.status === parsed.data.status) return ok(epoch);

  // Authorisation: OSD/Super Admin OR Director of a marked-to division.
  const meRow = await prisma.user.findUnique({
    where: { id: me.id },
    select: { hierarchySlot: true, isSuperAdmin: true, divisionId: true },
  });
  const allowed =
    meRow &&
    (meRow.isSuperAdmin ||
      meRow.hierarchySlot === 'osd' ||
      (meRow.hierarchySlot === 'director' &&
        tf.markedTo.some((m) => m.divisionId === meRow.divisionId)));
  if (!allowed) return fail('You do not have permission to change this status.', epoch);

  try {
    await prisma.$transaction([
      prisma.timelineFile.update({
        where: { id: tf.id },
        data: { status: parsed.data.status },
      }),
      prisma.timelineFileActivity.create({
        data: {
          timelineFileId: tf.id,
          actorId: me.id,
          eventType: 'status_changed',
          payload: { from: tf.status, to: parsed.data.status },
        },
      }),
    ]);
  } catch (err) {
    console.error('updateTimelineFileStatusAction failed:', err);
    return fail('Could not update status.', epoch);
  }

  revalidateTf(tf.id);
  return ok(epoch);
}

// ============================================================
// updateTimelineFileFieldsAction (subject / from / dates / comments)
// ============================================================

const updateFieldsSchema = z.object({
  id: z.string().uuid(),
  subject: z.string().trim().min(1).max(200).optional(),
  fromWhom: z.string().trim().min(1).max(120).optional(),
  receivedDate: z
    .string()
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined))
    .refine((s) => !s || !Number.isNaN(Date.parse(s)), 'Received date is invalid'),
  deadlineDate: z
    .string()
    .optional()
    .transform((s) => (s ? s : null))
    .refine((s) => s === null || !Number.isNaN(Date.parse(s)), 'Deadline date is invalid'),
  secretaryComments: z.string().max(4000).optional(),
});

export async function updateTimelineFileFieldsAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const guard = await requireOsdOrSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  const parsed = updateFieldsSchema.safeParse({
    id: formData.get('id'),
    subject: formData.has('subject') ? (formData.get('subject') as string) : undefined,
    fromWhom: formData.has('fromWhom') ? (formData.get('fromWhom') as string) : undefined,
    receivedDate: formData.has('receivedDate')
      ? (formData.get('receivedDate') as string)
      : undefined,
    deadlineDate: formData.has('deadlineDate')
      ? (formData.get('deadlineDate') as string)
      : undefined,
    secretaryComments: formData.has('secretaryComments')
      ? (formData.get('secretaryComments') as string)
      : undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors, epoch };
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.subject !== undefined) data.subject = parsed.data.subject;
  if (parsed.data.fromWhom !== undefined) data.fromWhom = parsed.data.fromWhom;
  if (parsed.data.receivedDate !== undefined)
    data.receivedDate = new Date(parsed.data.receivedDate);
  if (parsed.data.deadlineDate !== undefined)
    data.deadlineDate = parsed.data.deadlineDate ? new Date(parsed.data.deadlineDate) : null;
  if (parsed.data.secretaryComments !== undefined)
    data.secretaryComments = parsed.data.secretaryComments.length > 0
      ? parsed.data.secretaryComments
      : null;

  if (Object.keys(data).length === 0) return ok(epoch);

  try {
    await prisma.timelineFile.update({ where: { id: parsed.data.id }, data });
    await prisma.timelineFileActivity.create({
      data: {
        timelineFileId: parsed.data.id,
        actorId: guard.userId,
        eventType:
          parsed.data.secretaryComments !== undefined
            ? 'secretary_comment_added'
            : 'fields_updated',
        payload: { fields: Object.keys(data) },
      },
    });
  } catch (err) {
    console.error('updateTimelineFileFieldsAction failed:', err);
    return fail('Could not save changes.', epoch);
  }

  revalidateTf(parsed.data.id);
  return ok(epoch);
}

// ============================================================
// addMarkedToAction / removeMarkedToAction
// ============================================================

const markedToSchema = z.object({
  id: z.string().uuid(),
  divisionId: z.string().uuid(),
});

export async function addMarkedToAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const guard = await requireOsdOrSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  const parsed = markedToSchema.safeParse({
    id: formData.get('id'),
    divisionId: formData.get('divisionId'),
  });
  if (!parsed.success) return fail('Invalid input.', epoch);

  try {
    await prisma.timelineFileMarkedTo.create({
      data: {
        timelineFileId: parsed.data.id,
        divisionId: parsed.data.divisionId,
      },
    });
    await prisma.timelineFileActivity.create({
      data: {
        timelineFileId: parsed.data.id,
        actorId: guard.userId,
        eventType: 'marked_to_division',
        payload: { divisionId: parsed.data.divisionId },
      },
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    ) {
      return ok(epoch); // already marked
    }
    console.error('addMarkedToAction failed:', err);
    return fail('Could not mark to division.', epoch);
  }

  revalidateTf(parsed.data.id);
  return ok(epoch);
}

export async function removeMarkedToAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const guard = await requireOsdOrSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  const parsed = markedToSchema.safeParse({
    id: formData.get('id'),
    divisionId: formData.get('divisionId'),
  });
  if (!parsed.success) return fail('Invalid input.', epoch);

  try {
    await prisma.timelineFileMarkedTo.delete({
      where: {
        timelineFileId_divisionId: {
          timelineFileId: parsed.data.id,
          divisionId: parsed.data.divisionId,
        },
      },
    });
    await prisma.timelineFileActivity.create({
      data: {
        timelineFileId: parsed.data.id,
        actorId: guard.userId,
        eventType: 'marked_to_division_removed',
        payload: { divisionId: parsed.data.divisionId },
      },
    });
  } catch (err) {
    console.error('removeMarkedToAction failed:', err);
    return fail('Could not remove division.', epoch);
  }

  revalidateTf(parsed.data.id);
  return ok(epoch);
}

// ============================================================
// archiveTimelineFileAction
// ============================================================

const tfIdSchema = z.object({ id: z.string().uuid() });

export async function archiveTimelineFileAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const guard = await requireOsdOrSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  const parsed = tfIdSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const tf = await prisma.timelineFile.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, refNo: true, archivedAt: true },
  });
  if (!tf) return fail('Timeline file not found.', epoch);
  if (tf.archivedAt) return ok(epoch);

  try {
    await prisma.$transaction([
      prisma.timelineFile.update({
        where: { id: tf.id },
        data: { archivedAt: new Date(), archivedById: guard.userId },
      }),
      prisma.timelineFileActivity.create({
        data: {
          timelineFileId: tf.id,
          actorId: guard.userId,
          eventType: 'file_archived',
          payload: {},
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: guard.userId,
          action: 'archive',
          entityType: 'timeline_file',
          entityId: tf.id,
          before: { refNo: tf.refNo, archivedAt: null },
          after: { refNo: tf.refNo, archivedAt: new Date().toISOString() },
        },
      }),
    ]);
  } catch (err) {
    console.error('archiveTimelineFileAction failed:', err);
    return fail('Could not archive.', epoch);
  }

  revalidatePath('/timeline-files');
  return ok(epoch);
}

// ============================================================
// deleteTimelineFileAction — Super Admin only (hard delete)
// ============================================================

export async function deleteTimelineFileAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const session = await auth();
  if (!session?.user) return fail('You are signed out.', epoch);

  // Super Admin only — stricter than the other TF actions.
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSuperAdmin: true, isActive: true },
  });
  if (!me?.isActive || !me.isSuperAdmin) {
    return fail('Only Super Admin can hard-delete a timeline file.', epoch);
  }

  const parsed = tfIdSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const tf = await prisma.timelineFile.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, refNo: true, subject: true },
  });
  if (!tf) return fail('Timeline file not found.', epoch);

  try {
    await prisma.$transaction(async (tx) => {
      // Detach any tasks that still link to this TF (FK uses NoAction).
      await tx.task.updateMany({
        where: { linkedTimelineFileId: tf.id },
        data: { linkedTimelineFileId: null },
      });
      // Drop any polymorphic attachments rooted at the file. Children of
      // the TF (activity, marked-to, task-links) cascade.
      await tx.attachment.deleteMany({
        where: {
          ownerType: {
            in: ['timeline_file', 'timeline_file_source', 'timeline_file_action'],
          },
          ownerId: tf.id,
        },
      });
      await tx.timelineFile.delete({ where: { id: tf.id } });
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: 'delete',
          entityType: 'timeline_file',
          entityId: tf.id,
          before: { refNo: tf.refNo, subject: tf.subject },
          after: {},
        },
      });
    });
  } catch (err) {
    console.error('deleteTimelineFileAction failed:', err);
    return fail('Could not delete.', epoch);
  }

  revalidatePath('/timeline-files');
  return ok(epoch);
}
