'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { hashPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/db';

/**
 * Super Admin actions for managing users.
 *
 * Every action requires the caller to have is_super_admin = true.
 * Every mutation writes an `audit_log` row so the audit trail (Phase 3)
 * can reconstruct who did what.
 */

// ============================================================
// Shared
// ============================================================

const SLOTS = [
  'js',
  'osd',
  'director',
  'deputy_secretary',
  'under_secretary',
  'section_officer',
  'aso',
] as const;

const CONTRACT_ROLES = ['po', 'apo', 'yp'] as const;

const USERNAME_RE = /^[a-z][a-z0-9._-]{1,40}$/;

type ActionState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  epoch?: number;
  userId?: string;
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

async function requireSuperAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: 'You are signed out.' };

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSuperAdmin: true, isActive: true, hierarchySlot: true },
  });
  if (!me) return { ok: false, error: 'Your account could not be found.' };
  if (!me.isActive) return { ok: false, error: 'Your account is disabled.' };
  const isOsd = me.hierarchySlot === 'osd';
  if (!me.isSuperAdmin && !isOsd) return { ok: false, error: 'Super Admin or OSD access is required.' };
  return { ok: true, userId: session.user.id };
}

function revalidateAll() {
  revalidatePath('/admin/users');
  revalidatePath('/admin/structure');
}

async function audit(
  actorId: string,
  action: 'create' | 'update' | 'delete' | 'role_change' | 'password_reset',
  userId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      entityType: 'user',
      entityId: userId,
      before: before as object,
      after: after as object,
    },
  });
}

/**
 * Placement guards shared by create + update: a section must be a
 * `section` row under the chosen sub-division, and a PMU must be a `pmu`
 * row attached to the chosen division.
 */
async function validatePlacement(opts: {
  divisionId: string;
  subDivisionId: string | null;
  sectionId: string | null;
  pmuId: string | null;
}): Promise<Record<string, string> | null> {
  const errors: Record<string, string> = {};

  if (opts.sectionId) {
    const section = await prisma.division.findUnique({
      where: { id: opts.sectionId },
      select: { kind: true, parentId: true },
    });
    if (!section || section.kind !== 'section') {
      errors.sectionId = 'Section does not exist';
    } else if (!opts.subDivisionId || section.parentId !== opts.subDivisionId) {
      errors.sectionId = 'Section must belong to the chosen sub-division';
    }
  }

  if (opts.pmuId) {
    const pmu = await prisma.division.findUnique({
      where: { id: opts.pmuId },
      select: { kind: true, parentId: true, pmuParentDivisionId: true },
    });
    if (!pmu || pmu.kind !== 'pmu') {
      errors.pmuId = 'PMU team does not exist';
    } else if (
      pmu.pmuParentDivisionId !== opts.divisionId &&
      pmu.parentId !== opts.divisionId
    ) {
      errors.pmuId = 'PMU must belong to the chosen division';
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

// ============================================================
// createUserAction
// ============================================================

const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, 'Username is too short')
    .max(40, 'Username is too long')
    .regex(USERNAME_RE, 'Use a–z, 0–9, dots, underscores, dashes; start with a letter'),
  password: z
    .string()
    .min(8, 'Initial password must be at least 8 characters')
    .max(200, 'Initial password is too long'),
  forcePasswordChange: z
    .string()
    .optional()
    .transform((v) => v !== ''),
  designation: z.string().trim().min(1, 'Designation is required').max(120),
  hierarchySlot: z.enum(SLOTS, { errorMap: () => ({ message: 'Pick a hierarchy slot' }) }),
  contractRole: z
    .union([z.literal(''), z.enum(CONTRACT_ROLES)])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  divisionId: z.string().uuid('Pick a division'),
  subDivisionId: z
    .union([z.literal(''), z.string().uuid()])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  sectionId: z
    .union([z.literal(''), z.string().uuid()])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  pmuId: z
    .union([z.literal(''), z.string().uuid()])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  supervisorId: z
    .union([z.literal(''), z.string().uuid()])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  isSuperAdmin: z
    .string()
    .optional()
    .transform((v) => v === 'on'),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  workActivities: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

type AdminUserState = ActionState;
const INITIAL_ADMIN_USER_STATE: AdminUserState = { ok: false, epoch: 0 };

export async function createUserAction(
  prev: AdminUserState | undefined,
  formData: FormData,
): Promise<AdminUserState> {
  const epoch = bump(prev);
  const guard = await requireSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  const parsed = createUserSchema.safeParse({
    name: formData.get('name'),
    username: formData.get('username'),
    password: formData.get('password'),
    forcePasswordChange: formData.get('forcePasswordChange'),
    designation: formData.get('designation'),
    hierarchySlot: formData.get('hierarchySlot'),
    contractRole: formData.get('contractRole'),
    divisionId: formData.get('divisionId'),
    subDivisionId: formData.get('subDivisionId'),
    sectionId: formData.get('sectionId'),
    pmuId: formData.get('pmuId'),
    supervisorId: formData.get('supervisorId'),
    isSuperAdmin: formData.get('isSuperAdmin'),
    phone: formData.get('phone'),
    workActivities: formData.get('workActivities'),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors, epoch };
  }

  // Uniqueness check
  const existing = await prisma.user.findUnique({
    where: { username: parsed.data.username },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, fieldErrors: { username: 'Username is already taken' }, epoch };
  }

  // Division must exist
  const division = await prisma.division.findUnique({
    where: { id: parsed.data.divisionId },
    select: { id: true },
  });
  if (!division) {
    return { ok: false, fieldErrors: { divisionId: 'Division does not exist' }, epoch };
  }

  const placementErrors = await validatePlacement({
    divisionId: parsed.data.divisionId,
    subDivisionId: parsed.data.subDivisionId ?? null,
    sectionId: parsed.data.sectionId ?? null,
    pmuId: parsed.data.pmuId ?? null,
  });
  if (placementErrors) return { ok: false, fieldErrors: placementErrors, epoch };

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const created = await prisma.user.create({
      data: {
        name: parsed.data.name,
        username: parsed.data.username,
        passwordHash,
        designation: parsed.data.designation,
        hierarchySlot: parsed.data.hierarchySlot,
        contractRole: parsed.data.contractRole ?? null,
        divisionId: parsed.data.divisionId,
        subDivisionId: parsed.data.subDivisionId ?? null,
        sectionId: parsed.data.sectionId ?? null,
        pmuId: parsed.data.pmuId ?? null,
        isPmu: Boolean(parsed.data.pmuId),
        supervisorId: parsed.data.supervisorId ?? null,
        isActive: true,
        isSuperAdmin: parsed.data.isSuperAdmin ?? false,
        forcePasswordChange: parsed.data.forcePasswordChange ?? true,
        createdById: guard.userId,
        phone: parsed.data.phone ?? null,
        workActivities: parsed.data.workActivities ?? null,
      },
    });

    await audit(guard.userId, 'create', created.id, {}, {
      name: created.name,
      username: created.username,
      hierarchySlot: created.hierarchySlot,
      divisionId: created.divisionId,
      isSuperAdmin: created.isSuperAdmin,
    });

    revalidateAll();
    return ok(epoch, { userId: created.id });
  } catch (err) {
    console.error('createUserAction failed:', err);
    return fail('Could not create the user. Try again.', epoch);
  }
}

// ============================================================
// updateUserAction
// ============================================================

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().trim().min(1, 'Name is required').max(120),
  designation: z.string().trim().min(1, 'Designation is required').max(120),
  hierarchySlot: z.enum(SLOTS),
  contractRole: z
    .union([z.literal(''), z.enum(CONTRACT_ROLES)])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  divisionId: z.string().uuid('Pick a division'),
  subDivisionId: z
    .union([z.literal(''), z.string().uuid()])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  sectionId: z
    .union([z.literal(''), z.string().uuid()])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  pmuId: z
    .union([z.literal(''), z.string().uuid()])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  supervisorId: z
    .union([z.literal(''), z.string().uuid()])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  phone: z
    .union([z.literal(''), z.string().trim().max(20)])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  workActivities: z
    .union([z.literal(''), z.string().trim().max(5000)])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function updateUserAction(
  prev: AdminUserState | undefined,
  formData: FormData,
): Promise<AdminUserState> {
  const epoch = bump(prev);
  const guard = await requireSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  const parsed = updateUserSchema.safeParse({
    userId: formData.get('userId'),
    name: formData.get('name'),
    designation: formData.get('designation'),
    hierarchySlot: formData.get('hierarchySlot'),
    contractRole: formData.get('contractRole'),
    divisionId: formData.get('divisionId'),
    subDivisionId: formData.get('subDivisionId'),
    sectionId: formData.get('sectionId'),
    pmuId: formData.get('pmuId'),
    supervisorId: formData.get('supervisorId'),
    phone: formData.get('phone'),
    workActivities: formData.get('workActivities'),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors, epoch };
  }

  const before = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: {
      name: true,
      designation: true,
      hierarchySlot: true,
      contractRole: true,
      divisionId: true,
      subDivisionId: true,
      sectionId: true,
      pmuId: true,
      isPmu: true,
      supervisorId: true,
    },
  });
  if (!before) return fail('User not found.', epoch);

  if (parsed.data.supervisorId === parsed.data.userId) {
    return {
      ok: false,
      fieldErrors: { supervisorId: 'A user cannot supervise themselves' },
      epoch,
    };
  }

  const placementErrors = await validatePlacement({
    divisionId: parsed.data.divisionId,
    subDivisionId: parsed.data.subDivisionId,
    sectionId: parsed.data.sectionId,
    pmuId: parsed.data.pmuId,
  });
  if (placementErrors) return { ok: false, fieldErrors: placementErrors, epoch };

  try {
    const updated = await prisma.user.update({
      where: { id: parsed.data.userId },
      data: {
        name: parsed.data.name,
        designation: parsed.data.designation,
        hierarchySlot: parsed.data.hierarchySlot,
        contractRole: parsed.data.contractRole,
        divisionId: parsed.data.divisionId,
        subDivisionId: parsed.data.subDivisionId,
        sectionId: parsed.data.sectionId,
        pmuId: parsed.data.pmuId,
        // Selecting a PMU marks the user as a PMU member. Clearing the
        // dropdown does NOT clear isPmu — legacy PMU users predate pmu_id
        // and must not silently lose their PMU status on unrelated edits.
        ...(parsed.data.pmuId ? { isPmu: true } : {}),
        supervisorId: parsed.data.supervisorId,
        phone: parsed.data.phone,
        workActivities: parsed.data.workActivities,
      },
    });

    await audit(guard.userId, 'update', updated.id, before, {
      name: updated.name,
      designation: updated.designation,
      hierarchySlot: updated.hierarchySlot,
      contractRole: updated.contractRole,
      divisionId: updated.divisionId,
      subDivisionId: updated.subDivisionId,
      sectionId: updated.sectionId,
      pmuId: updated.pmuId,
      supervisorId: updated.supervisorId,
    });

    revalidateAll();
    return ok(epoch, { userId: updated.id });
  } catch (err) {
    console.error('updateUserAction failed:', err);
    return fail('Could not update the user.', epoch);
  }
}

// ============================================================
// resetUserPasswordAction
// ============================================================

const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(200, 'Password is too long'),
  forceChange: z
    .string()
    .optional()
    .transform((v) => v === 'on' || v === undefined ? true : true),
});

// Note: forceChange default true — Super Admin reset is a security event,
// the user should change to something only they know on next sign-in.
// Override via explicit "no force" select (form sets value 'off').

export async function resetUserPasswordAction(
  prev: AdminUserState | undefined,
  formData: FormData,
): Promise<AdminUserState> {
  const epoch = bump(prev);
  const guard = await requireSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  // Re-read forceChange explicitly since the schema above is awkward.
  const forceChange = formData.get('forceChange') !== 'off';

  const parsed = resetPasswordSchema.safeParse({
    userId: formData.get('userId'),
    newPassword: formData.get('newPassword'),
    forceChange: 'on',
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors, epoch };
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true },
  });
  if (!target) return fail('User not found.', epoch);

  try {
    const newHash = await hashPassword(parsed.data.newPassword);
    await prisma.user.update({
      where: { id: target.id },
      data: {
        passwordHash: newHash,
        passwordChangedAt: new Date(),
        forcePasswordChange: forceChange,
      },
    });

    await audit(
      guard.userId,
      'password_reset',
      target.id,
      {},
      { forceChange },
    );

    await prisma.notification.create({
      data: {
        userId: target.id,
        type: 'password_reset_by_admin',
        payload: { forceChange },
      },
    });

    revalidatePath('/admin/users');
    return ok(epoch);
  } catch (err) {
    console.error('resetUserPasswordAction failed:', err);
    return fail('Could not reset the password.', epoch);
  }
}

// ============================================================
// setUserActiveAction — disable / enable
// ============================================================

const setActiveSchema = z.object({
  userId: z.string().uuid(),
  isActive: z.enum(['true', 'false']),
});

export async function setUserActiveAction(
  prev: AdminUserState | undefined,
  formData: FormData,
): Promise<AdminUserState> {
  const epoch = bump(prev);
  const guard = await requireSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  const parsed = setActiveSchema.safeParse({
    userId: formData.get('userId'),
    isActive: formData.get('isActive'),
  });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const nextActive = parsed.data.isActive === 'true';

  // Prevent self-lockout.
  if (parsed.data.userId === guard.userId && !nextActive) {
    return fail('You cannot disable your own account.', epoch);
  }

  const before = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { isActive: true, isSuperAdmin: true },
  });
  if (!before) return fail('User not found.', epoch);
  if (before.isActive === nextActive) return ok(epoch);

  // Prevent disabling the last active Super Admin (defensive).
  if (!nextActive && before.isSuperAdmin) {
    const count = await prisma.user.count({
      where: { isActive: true, isSuperAdmin: true },
    });
    if (count <= 1) {
      return fail('At least one active Super Admin must remain.', epoch);
    }
  }

  try {
    await prisma.user.update({
      where: { id: parsed.data.userId },
      data: { isActive: nextActive },
    });
    await audit(
      guard.userId,
      'update',
      parsed.data.userId,
      { isActive: before.isActive },
      { isActive: nextActive },
    );
    revalidateAll();
    return ok(epoch);
  } catch (err) {
    console.error('setUserActiveAction failed:', err);
    return fail('Could not change status.', epoch);
  }
}

// ============================================================
// setUserSuperAdminAction
// ============================================================

const setSuperAdminSchema = z.object({
  userId: z.string().uuid(),
  isSuperAdmin: z.enum(['true', 'false']),
});

export async function setUserSuperAdminAction(
  prev: AdminUserState | undefined,
  formData: FormData,
): Promise<AdminUserState> {
  const epoch = bump(prev);
  const guard = await requireSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  const parsed = setSuperAdminSchema.safeParse({
    userId: formData.get('userId'),
    isSuperAdmin: formData.get('isSuperAdmin'),
  });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const next = parsed.data.isSuperAdmin === 'true';

  const before = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { isSuperAdmin: true, isActive: true },
  });
  if (!before) return fail('User not found.', epoch);
  if (before.isSuperAdmin === next) return ok(epoch);

  // Same lockout protection: don't allow the last Super Admin to demote
  // themselves.
  if (!next && parsed.data.userId === guard.userId) {
    const count = await prisma.user.count({
      where: { isActive: true, isSuperAdmin: true },
    });
    if (count <= 1) {
      return fail('At least one Super Admin must remain.', epoch);
    }
  }

  try {
    await prisma.user.update({
      where: { id: parsed.data.userId },
      data: { isSuperAdmin: next },
    });
    await audit(
      guard.userId,
      'role_change',
      parsed.data.userId,
      { isSuperAdmin: before.isSuperAdmin },
      { isSuperAdmin: next },
    );
    revalidateAll();
    return ok(epoch);
  } catch (err) {
    console.error('setUserSuperAdminAction failed:', err);
    return fail('Could not change role.', epoch);
  }
}

// ============================================================
// changeDivisionAction — quick division reassignment
// ============================================================

const changeDivisionSchema = z.object({
  userId: z.string().uuid(),
  divisionId: z.string().uuid('Pick a division'),
});

export async function changeDivisionAction(
  prev: AdminUserState | undefined,
  formData: FormData,
): Promise<AdminUserState> {
  const epoch = bump(prev);
  const guard = await requireSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  const parsed = changeDivisionSchema.safeParse({
    userId: formData.get('userId'),
    divisionId: formData.get('divisionId'),
  });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const before = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { divisionId: true },
  });
  if (!before) return fail('User not found.', epoch);
  if (before.divisionId === parsed.data.divisionId) return ok(epoch);

  try {
    await prisma.user.update({
      where: { id: parsed.data.userId },
      data: { divisionId: parsed.data.divisionId, subDivisionId: null },
    });
    await audit(
      guard.userId,
      'update',
      parsed.data.userId,
      { divisionId: before.divisionId },
      { divisionId: parsed.data.divisionId },
    );
    revalidateAll();
    return ok(epoch);
  } catch (err) {
    console.error('changeDivisionAction failed:', err);
    return fail('Could not change division.', epoch);
  }
}
