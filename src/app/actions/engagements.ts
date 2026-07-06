'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { istWallClockToUtc } from '@/lib/date';
import { prisma } from '@/lib/db';
import { canAccessEngagements, getOfficeOfJsDivisionId } from '@/lib/engagements';

import type { EngagementDetailData, EngagementState } from './states';

/**
 * JS Engagement server actions — create / update / delete.
 *
 * Every action re-checks the caller from the DB (never JWT) and gates on
 * Office-of-JS membership or Super Admin, matching the read gate in
 * `src/lib/engagements.ts`. Follows the platform action contract: bump the
 * epoch first, validate with Zod, write inside a transaction, then
 * revalidate and return a typed state.
 */

// ============================================================
// Shared
// ============================================================

function bump(prev: EngagementState | undefined): number {
  return (prev?.epoch ?? 0) + 1;
}
function fail(message: string, epoch: number, fieldErrors?: Record<string, string>): EngagementState {
  return { ok: false, error: message, epoch, fieldErrors };
}
function ok(epoch: number, extra?: Partial<EngagementState>): EngagementState {
  return { ok: true, epoch, ...extra };
}

/**
 * Resolve the caller and confirm they may manage engagements. Returns the
 * caller id + the Office of JS division id, or an error state.
 */
async function requireEngagementManager(
  epoch: number,
): Promise<
  | { ok: true; userId: string; officeOfJsDivisionId: string }
  | { ok: false; state: EngagementState }
> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, state: fail('You are signed out.', epoch) };
  }
  const [me, officeOfJsDivisionId] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, divisionId: true, isSuperAdmin: true, isActive: true },
    }),
    getOfficeOfJsDivisionId(),
  ]);
  if (!me?.isActive) {
    return { ok: false, state: fail('Your account could not be found.', epoch) };
  }
  if (!canAccessEngagements(me, officeOfJsDivisionId)) {
    return {
      ok: false,
      state: fail('Only the Office of JS or a Super Admin can manage engagements.', epoch),
    };
  }
  if (!officeOfJsDivisionId) {
    // A Super Admin with no Office of JS division configured cannot anchor
    // the engagement anywhere — surface it rather than guessing.
    return { ok: false, state: fail('The Office of JS division is not configured.', epoch) };
  }
  return { ok: true, userId: me.id, officeOfJsDivisionId };
}

const participantsSchema = z
  .string()
  .optional()
  .transform((s) => (s ? s.split(',').map((v) => v.trim()).filter(Boolean) : []))
  .pipe(z.array(z.string().uuid()).max(50, 'Too many participants'));

const driveUrlSchema = z
  .string()
  .trim()
  .optional()
  .transform((s) => (s && s.length > 0 ? s : undefined))
  .refine((s) => !s || /^https?:\/\//.test(s), 'Link must start with http:// or https://')
  .refine((s) => !s || s.length <= 1000, 'Link is too long');

const baseFields = {
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Pick a start time'),
  venue: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined)),
  momNotes: z
    .string()
    .trim()
    .max(8000)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined)),
  participantIds: participantsSchema,
  driveUrl: driveUrlSchema,
};

const createSchema = z.object(baseFields);
const updateSchema = z.object({ engagementId: z.string().uuid(), ...baseFields });

function readForm(formData: FormData) {
  return {
    title: formData.get('title'),
    date: formData.get('date'),
    startTime: formData.get('startTime'),
    venue: formData.get('venue') || undefined,
    momNotes: formData.get('momNotes') || undefined,
    participantIds: formData.get('participantIds') || undefined,
    driveUrl: formData.get('driveUrl') || undefined,
  };
}

function surfaceFieldErrors(issues: z.ZodIssue[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0]);
    if (['title', 'date', 'startTime', 'driveUrl'].includes(key)) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/** Keep only ids that belong to active users, so a stale picker can't inject bad rows. */
async function validParticipantIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.user.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function driveLinkAttachment(url: string) {
  let fileName = 'Linked file';
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && last.length > 0 && last.length < 100) fileName = decodeURIComponent(last);
  } catch {
    // keep default
  }
  return { fileName, fileUrl: url };
}

// ============================================================
// getEngagementDetail — read for the detail sheet
// ============================================================

/**
 * Full engagement for the detail sheet. Returns null when the caller may
 * not access engagements or the engagement is missing/archived. Seeing and
 * managing share the same gate, so this reuses the manager check.
 */
export async function getEngagementDetail(id: string): Promise<EngagementDetailData | null> {
  const guard = await requireEngagementManager(0);
  if (!guard.ok) return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const e = await prisma.jsEngagement.findFirst({
    where: { id, archivedAt: null },
    include: {
      createdBy: { select: { id: true, name: true } },
      participants: { include: { user: { select: { id: true, name: true } } } },
    },
  });
  if (!e) return null;

  const attachments = await prisma.attachment.findMany({
    where: { ownerType: 'js_engagement', ownerId: e.id },
    select: { id: true, fileName: true, fileUrl: true },
    orderBy: { uploadedAt: 'asc' },
  });

  return {
    id: e.id,
    title: e.title,
    startsAt: e.startsAt.toISOString(),
    venue: e.venue,
    momNotes: e.momNotes,
    createdBy: e.createdBy,
    participants: e.participants.map((p) => p.user),
    attachments,
  };
}

// ============================================================
// createEngagementAction
// ============================================================

export async function createEngagementAction(
  prev: EngagementState | undefined,
  formData: FormData,
): Promise<EngagementState> {
  const epoch = bump(prev);
  const guard = await requireEngagementManager(epoch);
  if (!guard.ok) return guard.state;

  const parsed = createSchema.safeParse(readForm(formData));
  if (!parsed.success) return { ok: false, fieldErrors: surfaceFieldErrors(parsed.error.issues), epoch };

  const startsAt = istWallClockToUtc(parsed.data.date, parsed.data.startTime);
  if (!startsAt) return fail('Date or time is invalid.', epoch, { date: 'Date or time is invalid' });

  const participantIds = await validParticipantIds(parsed.data.participantIds);

  try {
    const engagement = await prisma.$transaction(async (tx) => {
      const created = await tx.jsEngagement.create({
        data: {
          title: parsed.data.title,
          startsAt,
          venue: parsed.data.venue ?? null,
          momNotes: parsed.data.momNotes ?? null,
          divisionId: guard.officeOfJsDivisionId,
          createdById: guard.userId,
          participants: {
            createMany: { data: participantIds.map((userId) => ({ userId })) },
          },
        },
      });
      if (parsed.data.driveUrl) {
        const { fileName, fileUrl } = await driveLinkAttachment(parsed.data.driveUrl);
        await tx.attachment.create({
          data: {
            ownerType: 'js_engagement',
            ownerId: created.id,
            fileName,
            fileUrl,
            mimeType: null,
            sizeBytes: null,
            source: 'drive_link',
            uploadedById: guard.userId,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: guard.userId,
          action: 'create',
          entityType: 'js_engagement',
          entityId: created.id,
          before: {},
          after: { title: created.title, startsAt: created.startsAt.toISOString() },
        },
      });
      return created;
    });

    revalidatePath('/calendar');
    return ok(epoch, { engagementId: engagement.id });
  } catch (err) {
    console.error('createEngagementAction failed:', err);
    return fail('Could not save the engagement. Try again.', epoch);
  }
}

// ============================================================
// updateEngagementAction
// ============================================================

export async function updateEngagementAction(
  prev: EngagementState | undefined,
  formData: FormData,
): Promise<EngagementState> {
  const epoch = bump(prev);
  const guard = await requireEngagementManager(epoch);
  if (!guard.ok) return guard.state;

  const parsed = updateSchema.safeParse({
    engagementId: formData.get('engagementId'),
    ...readForm(formData),
  });
  if (!parsed.success) return { ok: false, fieldErrors: surfaceFieldErrors(parsed.error.issues), epoch };

  const existing = await prisma.jsEngagement.findFirst({
    where: { id: parsed.data.engagementId, archivedAt: null },
    select: { id: true },
  });
  if (!existing) return fail('Engagement not found.', epoch);

  const startsAt = istWallClockToUtc(parsed.data.date, parsed.data.startTime);
  if (!startsAt) return fail('Date or time is invalid.', epoch, { date: 'Date or time is invalid' });

  const participantIds = await validParticipantIds(parsed.data.participantIds);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.jsEngagement.update({
        where: { id: existing.id },
        data: {
          title: parsed.data.title,
          startsAt,
          venue: parsed.data.venue ?? null,
          momNotes: parsed.data.momNotes ?? null,
        },
      });
      // Replace the participant set wholesale — simplest correct semantics.
      await tx.jsEngagementParticipant.deleteMany({ where: { engagementId: existing.id } });
      if (participantIds.length > 0) {
        await tx.jsEngagementParticipant.createMany({
          data: participantIds.map((userId) => ({ engagementId: existing.id, userId })),
        });
      }
      if (parsed.data.driveUrl) {
        const { fileName, fileUrl } = await driveLinkAttachment(parsed.data.driveUrl);
        await tx.attachment.create({
          data: {
            ownerType: 'js_engagement',
            ownerId: existing.id,
            fileName,
            fileUrl,
            mimeType: null,
            sizeBytes: null,
            source: 'drive_link',
            uploadedById: guard.userId,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: guard.userId,
          action: 'update',
          entityType: 'js_engagement',
          entityId: existing.id,
          before: {},
          after: { title: parsed.data.title, startsAt: startsAt.toISOString() },
        },
      });
    });

    revalidatePath('/calendar');
    return ok(epoch, { engagementId: existing.id });
  } catch (err) {
    console.error('updateEngagementAction failed:', err);
    return fail('Could not save changes. Try again.', epoch);
  }
}

// ============================================================
// deleteEngagementAction
// ============================================================

const deleteSchema = z.object({ engagementId: z.string().uuid() });

export async function deleteEngagementAction(
  prev: EngagementState | undefined,
  formData: FormData,
): Promise<EngagementState> {
  const epoch = bump(prev);
  const guard = await requireEngagementManager(epoch);
  if (!guard.ok) return guard.state;

  const parsed = deleteSchema.safeParse({ engagementId: formData.get('engagementId') });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const existing = await prisma.jsEngagement.findUnique({
    where: { id: parsed.data.engagementId },
    select: { id: true, title: true },
  });
  if (!existing) return fail('Engagement not found.', epoch);

  try {
    await prisma.$transaction(async (tx) => {
      // Participants cascade with the engagement; attachments are polymorphic
      // (no FK) so drop them explicitly.
      await tx.attachment.deleteMany({
        where: { ownerType: 'js_engagement', ownerId: existing.id },
      });
      await tx.jsEngagement.delete({ where: { id: existing.id } });
      await tx.auditLog.create({
        data: {
          actorId: guard.userId,
          action: 'delete',
          entityType: 'js_engagement',
          entityId: existing.id,
          before: { title: existing.title },
          after: {},
        },
      });
    });

    revalidatePath('/calendar');
    return ok(epoch);
  } catch (err) {
    console.error('deleteEngagementAction failed:', err);
    return fail('Could not delete the engagement.', epoch);
  }
}
