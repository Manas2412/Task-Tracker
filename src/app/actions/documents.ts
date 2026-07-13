'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { CreateDocumentState } from '@/app/actions/states';
import { touchDocumentActivity } from '@/lib/activity';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  canAccessDocumentCentreById,
  documentMentionWhere,
  getDocumentAudienceUserIds,
  notifyDocumentAudience,
  writeDocumentAudit,
} from '@/lib/document-centre';
import { logError } from '@/lib/utils/log';

/**
 * Document Centre server actions. Every action re-checks the executive
 * allowlist (`canAccessDocumentCentreById`) — /api and server actions are not
 * gated by middleware, so this is the true security boundary (returns a
 * "not authorized" ActionState, the action equivalent of a 403).
 *
 * Contract: the shared epoch protocol — { ok, epoch, error?, fieldErrors? } —
 * so the forms + <Discussion> plug straight in. Notifications + audit follow
 * the codebase's inline-per-action idiom via the helpers in
 * src/lib/document-centre.ts.
 */

const COMMENT_EDIT_WINDOW_MS = 5 * 60 * 1000;

type ActionState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  epoch?: number;
  documentId?: string;
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

type Caller = { id: string; name?: string | null };

/** Gate + session. Returns the caller when authorized, else null. */
async function requireDocAccess(): Promise<Caller | null> {
  const session = await auth();
  if (!session?.user) return null;
  if (!(await canAccessDocumentCentreById(session.user.id))) return null;
  return { id: session.user.id, name: session.user.name };
}

function revalidateDoc(id: string) {
  revalidatePath(`/document-centre/${id}`);
  revalidatePath('/document-centre');
}

/** Resolve `@username` handles, narrowed to the executive audience. */
async function resolveDocumentMentions(body: string): Promise<string[]> {
  const handles = Array.from(body.matchAll(/@([a-z0-9][a-z0-9._-]{1,40})/gi)).map((m) =>
    m[1].toLowerCase(),
  );
  if (handles.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { ...documentMentionWhere(), username: { in: handles } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

// ============================================================
// Create
// ============================================================

const createSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(300),
  context: z.string().trim().max(5000).optional(),
  urgency: z.enum(['highly_urgent', 'urgent', 'normal']).default('normal'),
});

export async function createDocumentAction(
  prev: CreateDocumentState | undefined,
  formData: FormData,
): Promise<CreateDocumentState> {
  const epoch = bump(prev);
  const me = await requireDocAccess();
  if (!me) return fail('You are not authorized to create records.', epoch);

  const parsed = createSchema.safeParse({
    subject: formData.get('subject'),
    context: formData.get('context') || undefined,
    urgency: formData.get('urgency') || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors, epoch };
  }

  try {
    const record = await prisma.documentRecord.create({
      data: {
        subject: parsed.data.subject,
        context: parsed.data.context ?? null,
        urgency: parsed.data.urgency,
        createdById: me.id,
      },
      select: { id: true, subject: true },
    });

    await notifyDocumentAudience(prisma, {
      actorId: me.id,
      actorName: me.name,
      type: 'document_record_created',
      documentId: record.id,
      documentSubject: record.subject,
    });
    await writeDocumentAudit(prisma, {
      actorId: me.id,
      action: 'create',
      documentId: record.id,
      after: { subject: record.subject, urgency: parsed.data.urgency },
    });

    revalidatePath('/document-centre');
    return ok(epoch, { documentId: record.id });
  } catch (err) {
    logError('createDocumentAction failed', err);
    return fail('Could not create the record.', epoch);
  }
}

// ============================================================
// Field edits — subject + context
// ============================================================

const fieldsSchema = z.object({
  id: z.string().uuid(),
  subject: z.string().trim().min(1, 'Subject is required').max(300).optional(),
  context: z.string().trim().max(5000).optional(),
});

export async function updateDocumentFieldsAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireDocAccess();
  if (!me) return fail('You are not authorized.', epoch);

  const hasSubject = formData.has('subject');
  const hasContext = formData.has('context');
  const parsed = fieldsSchema.safeParse({
    id: formData.get('id'),
    subject: hasSubject ? formData.get('subject') : undefined,
    context: hasContext ? formData.get('context') || '' : undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors, epoch };
  }

  const existing = await prisma.documentRecord.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, subject: true, context: true, archivedAt: true },
  });
  if (!existing || existing.archivedAt) return fail('Record not found.', epoch);

  const data: { subject?: string; context?: string | null; lastActivityAt: Date } = {
    lastActivityAt: new Date(),
  };
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  if (hasSubject && parsed.data.subject !== undefined && parsed.data.subject !== existing.subject) {
    data.subject = parsed.data.subject;
    before.subject = existing.subject;
    after.subject = parsed.data.subject;
  }
  if (hasContext) {
    const next = parsed.data.context ? parsed.data.context : null;
    if (next !== existing.context) {
      data.context = next;
      before.context = existing.context;
      after.context = next;
    }
  }
  if (Object.keys(after).length === 0) return ok(epoch); // nothing changed

  try {
    await prisma.documentRecord.update({ where: { id: existing.id }, data });
    await writeDocumentAudit(prisma, {
      actorId: me.id,
      action: 'update',
      documentId: existing.id,
      before,
      after,
    });
  } catch (err) {
    logError('updateDocumentFieldsAction failed', err);
    return fail('Could not save changes.', epoch);
  }

  revalidateDoc(existing.id);
  return ok(epoch);
}

// ============================================================
// Urgency
// ============================================================

const urgencySchema = z.object({
  id: z.string().uuid(),
  urgency: z.enum(['highly_urgent', 'urgent', 'normal']),
});

export async function setDocumentUrgencyAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireDocAccess();
  if (!me) return fail('You are not authorized.', epoch);

  const parsed = urgencySchema.safeParse({
    id: formData.get('id'),
    urgency: formData.get('urgency'),
  });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const existing = await prisma.documentRecord.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, urgency: true, archivedAt: true },
  });
  if (!existing || existing.archivedAt) return fail('Record not found.', epoch);
  if (existing.urgency === parsed.data.urgency) return ok(epoch);

  try {
    await prisma.documentRecord.update({
      where: { id: existing.id },
      data: { urgency: parsed.data.urgency, lastActivityAt: new Date() },
    });
    await writeDocumentAudit(prisma, {
      actorId: me.id,
      action: 'update',
      documentId: existing.id,
      before: { urgency: existing.urgency },
      after: { urgency: parsed.data.urgency },
    });
  } catch (err) {
    logError('setDocumentUrgencyAction failed', err);
    return fail('Could not update urgency.', epoch);
  }

  revalidateDoc(existing.id);
  return ok(epoch);
}

// ============================================================
// Workflow — mark for review / awaiting input / completion
// ============================================================

const boolFlagSchema = z.object({
  id: z.string().uuid(),
  value: z.enum(['true', 'false']),
});

export async function setDocumentReviewAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireDocAccess();
  if (!me) return fail('You are not authorized.', epoch);

  const parsed = boolFlagSchema.safeParse({
    id: formData.get('id'),
    value: formData.get('value'),
  });
  if (!parsed.success) return fail('Invalid input.', epoch);
  const value = parsed.data.value === 'true';

  const existing = await prisma.documentRecord.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, subject: true, markedForReview: true, archivedAt: true },
  });
  if (!existing || existing.archivedAt) return fail('Record not found.', epoch);
  if (existing.markedForReview === value) return ok(epoch);

  try {
    await prisma.documentRecord.update({
      where: { id: existing.id },
      data: { markedForReview: value, lastActivityAt: new Date() },
    });
    // Turning review ON = review requested; OFF = review completed.
    await notifyDocumentAudience(prisma, {
      actorId: me.id,
      actorName: me.name,
      type: value ? 'document_review_requested' : 'document_review_completed',
      documentId: existing.id,
      documentSubject: existing.subject,
    });
    await writeDocumentAudit(prisma, {
      actorId: me.id,
      action: 'update',
      documentId: existing.id,
      before: { markedForReview: existing.markedForReview },
      after: { markedForReview: value },
    });
  } catch (err) {
    logError('setDocumentReviewAction failed', err);
    return fail('Could not update review status.', epoch);
  }

  revalidateDoc(existing.id);
  return ok(epoch);
}

export async function setDocumentAwaitingInputAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireDocAccess();
  if (!me) return fail('You are not authorized.', epoch);

  const parsed = boolFlagSchema.safeParse({
    id: formData.get('id'),
    value: formData.get('value'),
  });
  if (!parsed.success) return fail('Invalid input.', epoch);
  const value = parsed.data.value === 'true';

  const existing = await prisma.documentRecord.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, subject: true, awaitingInput: true, archivedAt: true },
  });
  if (!existing || existing.archivedAt) return fail('Record not found.', epoch);
  if (existing.awaitingInput === value) return ok(epoch);

  try {
    await prisma.documentRecord.update({
      where: { id: existing.id },
      data: { awaitingInput: value, lastActivityAt: new Date() },
    });
    if (value) {
      await notifyDocumentAudience(prisma, {
        actorId: me.id,
        actorName: me.name,
        type: 'document_awaiting_input',
        documentId: existing.id,
        documentSubject: existing.subject,
      });
    }
    await writeDocumentAudit(prisma, {
      actorId: me.id,
      action: 'update',
      documentId: existing.id,
      before: { awaitingInput: existing.awaitingInput },
      after: { awaitingInput: value },
    });
  } catch (err) {
    logError('setDocumentAwaitingInputAction failed', err);
    return fail('Could not update status.', epoch);
  }

  revalidateDoc(existing.id);
  return ok(epoch);
}

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['open', 'completed']),
});

export async function setDocumentStatusAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireDocAccess();
  if (!me) return fail('You are not authorized.', epoch);

  const parsed = statusSchema.safeParse({
    id: formData.get('id'),
    status: formData.get('status'),
  });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const existing = await prisma.documentRecord.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, status: true, archivedAt: true },
  });
  if (!existing || existing.archivedAt) return fail('Record not found.', epoch);
  if (existing.status === parsed.data.status) return ok(epoch);

  try {
    await prisma.documentRecord.update({
      where: { id: existing.id },
      data: { status: parsed.data.status, lastActivityAt: new Date() },
    });
    await writeDocumentAudit(prisma, {
      actorId: me.id,
      action: 'update',
      documentId: existing.id,
      before: { status: existing.status },
      after: { status: parsed.data.status },
    });
  } catch (err) {
    logError('setDocumentStatusAction failed', err);
    return fail('Could not update status.', epoch);
  }

  revalidateDoc(existing.id);
  return ok(epoch);
}

// ============================================================
// Delete (hard) — Super Admin or the record's creator
// ============================================================

const deleteSchema = z.object({ id: z.string().uuid() });

export async function deleteDocumentAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const session = await auth();
  if (!session?.user) return fail('You are signed out.', epoch);
  if (!(await canAccessDocumentCentreById(session.user.id))) {
    return fail('You are not authorized.', epoch);
  }

  const parsed = deleteSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const record = await prisma.documentRecord.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, subject: true, createdById: true },
  });
  if (!record) return fail('Record not found.', epoch);
  if (!session.user.isSuperAdmin && record.createdById !== session.user.id) {
    return fail('Only the creator or a Super Admin can delete a record.', epoch);
  }

  try {
    // Attachments are polymorphic (no FK) — remove their rows explicitly, then
    // the record (comments cascade). S3 objects are cleaned best-effort so a
    // failure there never blocks the delete.
    const attachments = await prisma.attachment.findMany({
      where: { ownerType: 'document_record', ownerId: record.id },
      select: { id: true, fileUrl: true, source: true },
    });
    await prisma.$transaction(async (tx) => {
      await tx.attachment.deleteMany({
        where: { ownerType: 'document_record', ownerId: record.id },
      });
      await tx.documentRecord.delete({ where: { id: record.id } });
      await writeDocumentAudit(tx, {
        actorId: session.user.id,
        action: 'delete',
        documentId: record.id,
        before: { subject: record.subject },
      });
    });

    const { deleteObject, isS3Configured } = await import('@/lib/s3');
    if (isS3Configured()) {
      for (const att of attachments) {
        if (att.source !== 'uploaded') continue;
        try {
          await deleteObject(att.fileUrl);
        } catch (err) {
          logError('S3 object delete failed (orphan left)', err);
        }
      }
    }
  } catch (err) {
    logError('deleteDocumentAction failed', err);
    return fail('Could not delete the record.', epoch);
  }

  revalidatePath('/document-centre');
  return ok(epoch);
}

// ============================================================
// Discussion — threaded comments (mirrors the TF comment actions)
// ============================================================

const postCommentSchema = z.object({
  id: z.string().uuid(),
  body: z.string().trim().min(1, 'Comment cannot be empty').max(4000),
  parentCommentId: z.string().uuid().optional(),
});

export async function postDocumentCommentAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireDocAccess();
  if (!me) return fail('You are not authorized.', epoch);

  const rawParent = formData.get('parentCommentId');
  const parsed = postCommentSchema.safeParse({
    id: formData.get('id'),
    body: formData.get('body'),
    parentCommentId: rawParent && rawParent !== '' ? String(rawParent) : undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors, epoch };
  }

  const record = await prisma.documentRecord.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, subject: true, archivedAt: true },
  });
  if (!record || record.archivedAt) return fail('Record not found.', epoch);

  const mentions = await resolveDocumentMentions(parsed.data.body);

  try {
    const comment = await prisma.documentComment.create({
      data: {
        documentRecordId: record.id,
        userId: me.id,
        body: parsed.data.body,
        mentions,
        parentCommentId: parsed.data.parentCommentId ?? null,
      },
    });
    await touchDocumentActivity(prisma, record.id);

    // Mentioned users get a mention notification; the rest of the audience gets
    // a "new discussion" notification. Never notify the actor or double-notify.
    const mentionedSet = new Set(mentions.filter((uid) => uid !== me.id));
    const audience = await getDocumentAudienceUserIds(me.id);
    const discussionRecipients = audience.filter((uid) => !mentionedSet.has(uid));

    const notifs = [
      ...[...mentionedSet].map((uid) => ({
        userId: uid,
        type: 'mention' as const,
        payload: {
          documentId: record.id,
          documentSubject: record.subject,
          commentId: comment.id,
          actorId: me.id,
          actorName: me.name ?? null,
        },
      })),
      ...discussionRecipients.map((uid) => ({
        userId: uid,
        type: 'document_discussion' as const,
        payload: {
          documentId: record.id,
          documentSubject: record.subject,
          commentId: comment.id,
          actorId: me.id,
          actorName: me.name ?? null,
        },
      })),
    ];
    if (notifs.length > 0) await prisma.notification.createMany({ data: notifs });
  } catch (err) {
    logError('postDocumentCommentAction failed', err);
    return fail('Could not post comment.', epoch);
  }

  revalidateDoc(record.id);
  return ok(epoch);
}

const editCommentSchema = z.object({
  commentId: z.string().uuid(),
  body: z.string().trim().min(1, 'Comment cannot be empty').max(4000),
});

export async function editDocumentCommentAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireDocAccess();
  if (!me) return fail('You are not authorized.', epoch);

  const parsed = editCommentSchema.safeParse({
    commentId: formData.get('commentId'),
    body: formData.get('body'),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors, epoch };
  }

  const comment = await prisma.documentComment.findUnique({
    where: { id: parsed.data.commentId },
    select: { id: true, userId: true, documentRecordId: true, createdAt: true },
  });
  if (!comment) return fail('Comment not found.', epoch);
  if (comment.userId !== me.id) return fail('You can only edit your own comments.', epoch);
  if (Date.now() - comment.createdAt.getTime() > COMMENT_EDIT_WINDOW_MS) {
    return fail('Comments can only be edited within 5 minutes of posting.', epoch);
  }

  const mentions = await resolveDocumentMentions(parsed.data.body);

  try {
    await prisma.documentComment.update({
      where: { id: comment.id },
      data: { body: parsed.data.body, mentions, editedAt: new Date() },
    });
  } catch (err) {
    logError('editDocumentCommentAction failed', err);
    return fail('Could not edit comment.', epoch);
  }

  revalidateDoc(comment.documentRecordId);
  return ok(epoch);
}

const deleteCommentSchema = z.object({ commentId: z.string().uuid() });

export async function deleteDocumentCommentAction(
  prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const epoch = bump(prev);
  const me = await requireDocAccess();
  if (!me) return fail('You are not authorized.', epoch);

  const parsed = deleteCommentSchema.safeParse({ commentId: formData.get('commentId') });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const comment = await prisma.documentComment.findUnique({
    where: { id: parsed.data.commentId },
    select: { id: true, userId: true, documentRecordId: true, createdAt: true },
  });
  if (!comment) return fail('Comment not found.', epoch);
  if (comment.userId !== me.id) return fail('You can only delete your own comments.', epoch);
  if (Date.now() - comment.createdAt.getTime() > COMMENT_EDIT_WINDOW_MS) {
    return fail('Comments can only be deleted within 5 minutes of posting.', epoch);
  }

  try {
    await prisma.documentComment.delete({ where: { id: comment.id } });
  } catch (err) {
    logError('deleteDocumentCommentAction failed', err);
    return fail('Could not delete comment.', epoch);
  }

  revalidateDoc(comment.documentRecordId);
  return ok(epoch);
}
