'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  deleteObject as deleteS3Object,
  isS3Configured,
  keyMatchesScope,
  MAX_UPLOAD_BYTES,
} from '@/lib/s3';

/**
 * Attachment actions.
 *
 * Upload path:
 *   1. Client POSTs to /api/attachments/upload-url with metadata → gets
 *      a presigned PUT URL + the resulting object key
 *   2. Client PUTs the file directly to S3 with that URL
 *   3. Client calls registerAttachmentAction with the key + metadata,
 *      which validates the key prefix matches the declared scope and
 *      records the row in the database
 *
 * Drive-link path bypasses S3 entirely.
 *
 * Permissions:
 *   - Task attachments: owner / creator / OSD / Super Admin
 *   - TF source docs:   OSD / Super Admin / Director of any marked-to division
 *   - TF action doc:    same as TF source
 */

// ============================================================
// Shared
// ============================================================

type ActionState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  epoch?: number;
  attachmentId?: string;
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

// ============================================================
// Permission helpers
// ============================================================

export async function canEditTaskAttachments(
  callerId: string,
  taskId: string,
): Promise<boolean> {
  const [me, task] = await Promise.all([
    prisma.user.findUnique({
      where: { id: callerId },
      select: { isSuperAdmin: true, hierarchySlot: true },
    }),
    prisma.task.findUnique({
      where: { id: taskId },
      select: { ownerId: true, createdById: true },
    }),
  ]);
  if (!me || !task) return false;
  return (
    me.isSuperAdmin ||
    me.hierarchySlot === 'osd' ||
    task.ownerId === callerId ||
    task.createdById === callerId
  );
}

export async function canEditTfAttachments(
  callerId: string,
  tfId: string,
): Promise<boolean> {
  const me = await prisma.user.findUnique({
    where: { id: callerId },
    select: { isSuperAdmin: true, hierarchySlot: true, divisionId: true },
  });
  if (!me) return false;
  if (me.isSuperAdmin || me.hierarchySlot === 'osd') return true;
  if (me.hierarchySlot !== 'director') return false;
  const marked = await prisma.timelineFileMarkedTo.findFirst({
    where: { timelineFileId: tfId, divisionId: me.divisionId },
    select: { timelineFileId: true },
  });
  return !!marked;
}

// ============================================================
// registerAttachmentAction
//   Called after the browser successfully PUTs the file to S3.
//   Validates the key prefix against the declared scope and records.
// ============================================================

const registerSchema = z.object({
  scope: z.enum(['task', 'tf_source', 'tf_action']),
  parentId: z.string().uuid(),
  source: z.literal('uploaded'),
  key: z.string().min(1).max(500),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().max(200).optional(),
  sizeBytes: z.coerce.number().int().nonnegative().max(MAX_UPLOAD_BYTES),
});

export async function registerAttachmentAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  if (!isS3Configured()) {
    return fail('Storage is not configured on this server.', epoch);
  }

  const parsed = registerSchema.safeParse({
    scope: formData.get('scope'),
    parentId: formData.get('parentId'),
    source: formData.get('source'),
    key: formData.get('key'),
    fileName: formData.get('fileName'),
    mimeType: formData.get('mimeType') || undefined,
    sizeBytes: formData.get('sizeBytes'),
  });
  if (!parsed.success) return fail('Invalid attachment metadata.', epoch);

  // Validate the key prefix matches the declared scope so the client can't
  // claim ownership of an arbitrary bucket object.
  const matches =
    (parsed.data.scope === 'task' &&
      keyMatchesScope(parsed.data.key, { kind: 'task', taskId: parsed.data.parentId })) ||
    (parsed.data.scope === 'tf_source' &&
      keyMatchesScope(parsed.data.key, { kind: 'tf_source', tfId: parsed.data.parentId })) ||
    (parsed.data.scope === 'tf_action' &&
      keyMatchesScope(parsed.data.key, { kind: 'tf_action', tfId: parsed.data.parentId }));
  if (!matches) return fail('Key does not match the declared parent.', epoch);

  // Permission check
  const allowed =
    parsed.data.scope === 'task'
      ? await canEditTaskAttachments(me.id, parsed.data.parentId)
      : await canEditTfAttachments(me.id, parsed.data.parentId);
  if (!allowed) return fail('You do not have permission.', epoch);

  return writeAttachment({
    me,
    scope: parsed.data.scope,
    parentId: parsed.data.parentId,
    source: 'uploaded',
    fileName: parsed.data.fileName,
    fileUrl: parsed.data.key,
    mimeType: parsed.data.mimeType ?? null,
    sizeBytes: parsed.data.sizeBytes,
    epoch,
  });
}

// ============================================================
// addDriveLinkAttachmentAction — no S3 needed
// ============================================================

const driveSchema = z.object({
  scope: z.enum(['task', 'tf_source', 'tf_action']),
  parentId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(200),
  driveUrl: z
    .string()
    .trim()
    .url('Enter a valid URL')
    .refine((s) => /^https?:\/\//.test(s), 'URL must start with http:// or https://')
    .refine((s) => s.length <= 1000, 'URL is too long'),
});

export async function addDriveLinkAttachmentAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = driveSchema.safeParse({
    scope: formData.get('scope'),
    parentId: formData.get('parentId'),
    fileName: formData.get('fileName'),
    driveUrl: formData.get('driveUrl'),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors, epoch };
  }

  const allowed =
    parsed.data.scope === 'task'
      ? await canEditTaskAttachments(me.id, parsed.data.parentId)
      : await canEditTfAttachments(me.id, parsed.data.parentId);
  if (!allowed) return fail('You do not have permission.', epoch);

  return writeAttachment({
    me,
    scope: parsed.data.scope,
    parentId: parsed.data.parentId,
    source: 'drive_link',
    fileName: parsed.data.fileName,
    fileUrl: parsed.data.driveUrl,
    mimeType: null,
    sizeBytes: null,
    epoch,
  });
}

// ============================================================
// Shared write step + activity + revalidation
// ============================================================

async function writeAttachment(args: {
  me: { id: string };
  scope: 'task' | 'tf_source' | 'tf_action';
  parentId: string;
  source: 'uploaded' | 'drive_link';
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  sizeBytes: number | null;
  epoch: number;
}): Promise<ActionState> {
  const ownerType =
    args.scope === 'task'
      ? 'task'
      : args.scope === 'tf_source'
        ? 'timeline_file_source'
        : 'timeline_file_action';

  try {
    const created = await prisma.attachment.create({
      data: {
        ownerType,
        ownerId: args.parentId,
        fileName: args.fileName,
        fileUrl: args.fileUrl,
        mimeType: args.mimeType,
        sizeBytes: args.sizeBytes,
        source: args.source,
        uploadedById: args.me.id,
      },
    });

    if (args.scope === 'task') {
      await prisma.taskActivity.create({
        data: {
          taskId: args.parentId,
          actorId: args.me.id,
          eventType: 'attachment_uploaded',
          payload: { fileName: args.fileName, source: args.source },
        },
      });
      revalidatePath(`/tasks/${args.parentId}`);
    } else {
      // tf_source or tf_action
      if (args.scope === 'tf_action') {
        // Point the TF at this attachment as the canonical action document.
        // We don't delete previous action documents — keep the audit trail.
        await prisma.timelineFile.update({
          where: { id: args.parentId },
          data: { actionDocumentAttachmentId: created.id },
        });
        await prisma.timelineFileActivity.create({
          data: {
            timelineFileId: args.parentId,
            actorId: args.me.id,
            eventType: 'action_document_uploaded',
            payload: { fileName: args.fileName, source: args.source },
          },
        });
      } else {
        await prisma.timelineFileActivity.create({
          data: {
            timelineFileId: args.parentId,
            actorId: args.me.id,
            eventType: 'source_document_added',
            payload: { fileName: args.fileName, source: args.source },
          },
        });
      }
      revalidatePath(`/timeline-files/${args.parentId}`);
    }

    return ok(args.epoch, { attachmentId: created.id });
  } catch (err) {
    console.error('writeAttachment failed:', err);
    return fail('Could not save the attachment.', args.epoch);
  }
}

// ============================================================
// renameAttachmentAction
// ============================================================

const renameSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string().trim().min(1).max(200),
});

export async function renameAttachmentAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = renameSchema.safeParse({
    id: formData.get('id'),
    fileName: formData.get('fileName'),
  });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const att = await prisma.attachment.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      ownerType: true,
      ownerId: true,
      uploadedById: true,
      fileName: true,
    },
  });
  if (!att) return fail('Attachment not found.', epoch);

  let editor = att.uploadedById === me.id;
  if (!editor) {
    if (att.ownerType === 'task') {
      editor = await canEditTaskAttachments(me.id, att.ownerId);
    } else {
      editor = await canEditTfAttachments(me.id, att.ownerId);
    }
  }
  if (!editor) return fail('You do not have permission.', epoch);

  const oldName = att.fileName;
  try {
    await prisma.attachment.update({
      where: { id: att.id },
      data: { fileName: parsed.data.fileName },
    });

    if (att.ownerType === 'task') {
      await prisma.taskActivity.create({
        data: {
          taskId: att.ownerId,
          actorId: me.id,
          eventType: 'attachment_renamed',
          payload: { oldName, newName: parsed.data.fileName },
        },
      });
      revalidatePath(`/tasks/${att.ownerId}`);
    } else {
      await prisma.timelineFileActivity.create({
        data: {
          timelineFileId: att.ownerId,
          actorId: me.id,
          eventType: 'attachment_renamed',
          payload: { oldName, newName: parsed.data.fileName },
        },
      });
      revalidatePath(`/timeline-files/${att.ownerId}`);
    }

    return ok(epoch);
  } catch (err) {
    console.error('renameAttachmentAction failed:', err);
    return fail('Could not rename.', epoch);
  }
}

// ============================================================
// deleteAttachmentAction
// ============================================================

const deleteSchema = z.object({ id: z.string().uuid() });

export async function deleteAttachmentAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireSession();
  if (!me) return fail('You are signed out.', epoch);

  const parsed = deleteSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const att = await prisma.attachment.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      ownerType: true,
      ownerId: true,
      uploadedById: true,
      fileName: true,
      fileUrl: true,
      source: true,
    },
  });
  if (!att) return fail('Attachment not found.', epoch);

  // Permission: uploader or someone with edit rights on the parent
  let editor = att.uploadedById === me.id;
  if (!editor) {
    if (att.ownerType === 'task') {
      editor = await canEditTaskAttachments(me.id, att.ownerId);
    } else {
      editor = await canEditTfAttachments(me.id, att.ownerId);
    }
  }
  if (!editor) return fail('You do not have permission.', epoch);

  try {
    await prisma.$transaction(async (tx) => {
      // If this is the canonical TF action document, clear the FK first.
      if (att.ownerType === 'timeline_file_action') {
        await tx.timelineFile.updateMany({
          where: { actionDocumentAttachmentId: att.id },
          data: { actionDocumentAttachmentId: null },
        });
      }
      await tx.attachment.delete({ where: { id: att.id } });
      if (att.ownerType === 'task') {
        await tx.taskActivity.create({
          data: {
            taskId: att.ownerId,
            actorId: me.id,
            eventType: 'attachment_removed',
            payload: { fileName: att.fileName },
          },
        });
      } else {
        await tx.timelineFileActivity.create({
          data: {
            timelineFileId: att.ownerId,
            actorId: me.id,
            eventType: 'attachment_removed',
            payload: { fileName: att.fileName, ownerType: att.ownerType },
          },
        });
      }
    });

    // Best-effort S3 delete — failure here doesn't block the row delete
    if (att.source === 'uploaded' && isS3Configured()) {
      try {
        await deleteS3Object(att.fileUrl);
      } catch (err) {
        console.error('S3 object delete failed (orphan left):', err);
      }
    }

    if (att.ownerType === 'task') {
      revalidatePath(`/tasks/${att.ownerId}`);
    } else {
      revalidatePath(`/timeline-files/${att.ownerId}`);
    }
    return ok(epoch);
  } catch (err) {
    console.error('deleteAttachmentAction failed:', err);
    return fail('Could not delete.', epoch);
  }
}
