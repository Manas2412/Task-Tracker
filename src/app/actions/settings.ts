'use server';
import { logError } from '@/lib/utils/log';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * App-level settings actions.
 *
 * Phase 4: the headline action is the testing→operational cutover purge
 * (PRD §12). It wipes every entity except the calling Super Admin and
 * their division, then records a single audit_log row marking the
 * transition to operational mode.
 *
 *   - Caller must be Super Admin
 *   - Caller must type the confirmation phrase literally
 *   - Caller's own account, division, and `audit_log` itself are preserved
 */

type ActionState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  epoch?: number;
  deletedCounts?: Record<string, number>;
};

const CONFIRMATION_PHRASE = 'PURGE MOCK DATA';

const purgeSchema = z.object({
  confirmation: z
    .string()
    .trim()
    .refine(
      (s) => s === CONFIRMATION_PHRASE,
      `Type "${CONFIRMATION_PHRASE}" exactly to confirm`,
    ),
});

export async function purgeMockDataAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = (prev?.epoch ?? 0) + 1;

  // 1. Super Admin guard
  const session = await auth();
  if (!session?.user) return { ok: false, error: 'You are signed out.', epoch };

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      isActive: true,
      isSuperAdmin: true,
      divisionId: true,
    },
  });
  if (!me?.isActive || !me.isSuperAdmin) {
    return { ok: false, error: 'Super Admin access is required.', epoch };
  }

  // 2. Typed confirmation
  const parsed = purgeSchema.safeParse({
    confirmation: formData.get('confirmation'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: {
        confirmation: parsed.error.issues[0]?.message ?? 'Confirmation mismatch',
      },
      epoch,
    };
  }

  // 3. Atomic wipe — order matters because we keep ON DELETE NO ACTION on
  // most user/division FKs.
  try {
    const deletedCounts = await prisma.$transaction(async (tx) => {
      // Activity / log children of tasks + TFs first
      const tfActivity = await tx.timelineFileActivity.deleteMany({});
      const tfLinks = await tx.timelineFileTaskLink.deleteMany({});
      const tfMarked = await tx.timelineFileMarkedTo.deleteMany({});
      const taskActivity = await tx.taskActivity.deleteMany({});
      const taskComments = await tx.taskComment.deleteMany({});
      const taskCollabs = await tx.taskCollaborator.deleteMany({});
      const taskTags = await tx.taskTag.deleteMany({});
      const reassignments = await tx.reassignmentRequest.deleteMany({});
      const notifications = await tx.notification.deleteMany({});
      const attachments = await tx.attachment.deleteMany({});

      // Parent entities
      const tasks = await tx.task.deleteMany({});
      const tfs = await tx.timelineFile.deleteMany({});
      const tags = await tx.tag.deleteMany({});

      // Users — preserve the calling Super Admin only.
      // Clear supervisorId on any user that points at someone else first,
      // then delete in two passes (subordinates, then everyone else).
      await tx.user.updateMany({
        where: { id: { not: me.id } },
        data: { supervisorId: null, createdById: null },
      });
      const users = await tx.user.deleteMany({
        where: { id: { not: me.id } },
      });

      // Divisions — preserve only the caller's division and its parents.
      const myDivision = await tx.division.findUnique({
        where: { id: me.divisionId },
        select: { id: true, parentId: true },
      });
      const keepIds = new Set<string>();
      if (myDivision) {
        keepIds.add(myDivision.id);
        let cur: string | null = myDivision.parentId;
        while (cur) {
          keepIds.add(cur);
          const parent: { parentId: string | null } | null = await tx.division.findUnique({
            where: { id: cur },
            select: { parentId: true },
          });
          cur = parent?.parentId ?? null;
        }
      }

      // First clear any FK pointers on divisions we're keeping that point
      // at divisions we're about to delete.
      await tx.division.updateMany({
        where: {
          id: { in: Array.from(keepIds) },
          createdById: { not: me.id },
        },
        data: { createdById: null },
      });

      const divisions = await tx.division.deleteMany({
        where: { id: { notIn: Array.from(keepIds) } },
      });

      // Single audit row marking the transition.
      await tx.auditLog.create({
        data: {
          actorId: me.id,
          action: 'delete',
          entityType: 'system',
          entityId: '00000000-0000-0000-0000-000000000000',
          before: {},
          after: {
            event: 'operational_cutover',
            note: 'Mock data purged; live operation begins',
            counts: {
              tasks: tasks.count,
              tfs: tfs.count,
              users: users.count,
              divisions: divisions.count,
              tags: tags.count,
            },
          },
        },
      });

      return {
        tasks: tasks.count,
        timeline_files: tfs.count,
        tags: tags.count,
        users: users.count,
        divisions: divisions.count,
        attachments: attachments.count,
        notifications: notifications.count,
        comments: taskComments.count,
        collaborators: taskCollabs.count,
        task_tags: taskTags.count,
        task_activity: taskActivity.count,
        timeline_file_activity: tfActivity.count,
        timeline_file_marked_to: tfMarked.count,
        timeline_file_task_links: tfLinks.count,
        reassignment_requests: reassignments.count,
      };
    });

    revalidatePath('/admin/settings');
    revalidatePath('/admin/users');
    revalidatePath('/admin/structure');
    revalidatePath('/admin/audit');
    revalidatePath('/tasks');
    revalidatePath('/timeline-files');

    return { ok: true, deletedCounts, epoch };
  } catch (err) {
    logError('purgeMockDataAction failed', err);
    return { ok: false, error: 'Purge failed. Try again or check the server log.', epoch };
  }
}
