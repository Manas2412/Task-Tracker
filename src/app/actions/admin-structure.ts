'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Super Admin actions for managing divisions and hierarchy.
 *
 *   - createDivisionAction:   create division / sub-division / section / PMU
 *   - renameDivisionAction:   rename a node
 *   - deleteDivisionAction:   only if it has no users and no children
 *   - setUserSupervisorAction: drag-and-drop reassignment, with cycle check
 *
 * Every mutation writes an `audit_log` row.
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
    select: { isSuperAdmin: true, isActive: true },
  });
  if (!me || !me.isActive) return { ok: false, error: 'Your account is unavailable.' };
  if (!me.isSuperAdmin) return { ok: false, error: 'Super Admin access is required.' };
  return { ok: true, userId: session.user.id };
}

function revalidateAll() {
  revalidatePath('/admin/structure');
  revalidatePath('/admin/users');
}

async function audit(
  actorId: string,
  action: 'create' | 'update' | 'delete' | 'hierarchy_change',
  entityType: 'division' | 'user',
  entityId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: { actorId, action, entityType, entityId, before: before as object, after: after as object },
  });
}

// ============================================================
// createDivisionAction
// ============================================================

const KINDS = ['division', 'sub_division', 'section', 'pmu'] as const;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const createDivisionSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80, 'Name is too long'),
    kind: z.enum(KINDS, { errorMap: () => ({ message: 'Pick a kind' }) }),
    parentId: z
      .union([z.literal(''), z.string().uuid()])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    pmuParentDivisionId: z
      .union([z.literal(''), z.string().uuid()])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    avatarColour: z
      .string()
      .regex(HEX_RE, 'Pick a colour from the palette')
      .default('#1e1b4b'),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'division' && data.parentId) {
      ctx.addIssue({ code: 'custom', path: ['parentId'], message: 'Top-level divisions have no parent' });
    }
    if (data.kind === 'sub_division' && !data.parentId) {
      ctx.addIssue({ code: 'custom', path: ['parentId'], message: 'Sub-divisions need a parent division' });
    }
    if (data.kind === 'section' && !data.parentId) {
      ctx.addIssue({ code: 'custom', path: ['parentId'], message: 'Sections need a parent sub-division' });
    }
    if (data.kind === 'pmu' && !data.pmuParentDivisionId) {
      ctx.addIssue({
        code: 'custom',
        path: ['pmuParentDivisionId'],
        message: 'PMU teams attach to a division',
      });
    }
  });

type AdminStructureState = ActionState;
const INITIAL_STRUCTURE_STATE: AdminStructureState = { ok: false, epoch: 0 };

export async function createDivisionAction(
  prev: AdminStructureState | undefined,
  formData: FormData,
): Promise<AdminStructureState> {
  const epoch = bump(prev);
  const guard = await requireSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  const parsed = createDivisionSchema.safeParse({
    name: formData.get('name'),
    kind: formData.get('kind'),
    parentId: formData.get('parentId'),
    pmuParentDivisionId: formData.get('pmuParentDivisionId'),
    avatarColour: formData.get('avatarColour') ?? '#1e1b4b',
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors, epoch };
  }

  // Validate parent (must exist + be of the correct kind one level up).
  if (parsed.data.parentId) {
    const parent = await prisma.division.findUnique({
      where: { id: parsed.data.parentId },
      select: { kind: true },
    });
    if (!parent) {
      return { ok: false, fieldErrors: { parentId: 'Parent does not exist' }, epoch };
    }
    if (parsed.data.kind === 'sub_division' && parent.kind !== 'division') {
      return { ok: false, fieldErrors: { parentId: 'Pick a top-level division' }, epoch };
    }
    if (parsed.data.kind === 'section' && parent.kind !== 'sub_division') {
      return { ok: false, fieldErrors: { parentId: 'Pick a sub-division' }, epoch };
    }
  }
  if (parsed.data.pmuParentDivisionId) {
    const pmuParent = await prisma.division.findUnique({
      where: { id: parsed.data.pmuParentDivisionId },
      select: { kind: true },
    });
    if (!pmuParent || pmuParent.kind !== 'division') {
      return {
        ok: false,
        fieldErrors: { pmuParentDivisionId: 'PMU must attach to a division' },
        epoch,
      };
    }
  }

  try {
    const created = await prisma.division.create({
      data: {
        name: parsed.data.name,
        kind: parsed.data.kind,
        parentId: parsed.data.parentId,
        pmuParentDivisionId: parsed.data.pmuParentDivisionId,
        avatarColour: parsed.data.avatarColour,
        displayOrder: 0,
        createdById: guard.userId,
      },
    });

    // If creating a PMU, flag the parent division.
    if (parsed.data.kind === 'pmu' && parsed.data.pmuParentDivisionId) {
      await prisma.division.update({
        where: { id: parsed.data.pmuParentDivisionId },
        data: { hasPmu: true },
      });
    }

    await audit(guard.userId, 'create', 'division', created.id, {}, {
      name: created.name,
      kind: created.kind,
      parentId: created.parentId,
      pmuParentDivisionId: created.pmuParentDivisionId,
    });

    revalidateAll();
    return ok(epoch, { id: created.id });
  } catch (err) {
    console.error('createDivisionAction failed:', err);
    return fail('Could not create. Try again.', epoch);
  }
}

// ============================================================
// renameDivisionAction
// ============================================================

const renameDivisionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Name is required').max(80),
});

export async function renameDivisionAction(
  prev: AdminStructureState | undefined,
  formData: FormData,
): Promise<AdminStructureState> {
  const epoch = bump(prev);
  const guard = await requireSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  const parsed = renameDivisionSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors, epoch };
  }

  const before = await prisma.division.findUnique({
    where: { id: parsed.data.id },
    select: { name: true },
  });
  if (!before) return fail('Not found.', epoch);
  if (before.name === parsed.data.name) return ok(epoch);

  try {
    await prisma.division.update({
      where: { id: parsed.data.id },
      data: { name: parsed.data.name },
    });
    await audit(guard.userId, 'update', 'division', parsed.data.id, before, {
      name: parsed.data.name,
    });
  } catch (err) {
    console.error('renameDivisionAction failed:', err);
    return fail('Could not rename.', epoch);
  }

  revalidateAll();
  return ok(epoch);
}

// ============================================================
// deleteDivisionAction (empty only)
// ============================================================

const deleteDivisionSchema = z.object({ id: z.string().uuid() });

export async function deleteDivisionAction(
  prev: AdminStructureState | undefined,
  formData: FormData,
): Promise<AdminStructureState> {
  const epoch = bump(prev);
  const guard = await requireSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  const parsed = deleteDivisionSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return fail('Invalid input.', epoch);

  const node = await prisma.division.findUnique({
    where: { id: parsed.data.id },
    select: {
      name: true,
      kind: true,
      pmuParentDivisionId: true,
      _count: {
        select: {
          children: true,
          usersInDivision: true,
          usersInSubDivision: true,
          usersInSection: true,
          tasks: true,
        },
      },
    },
  });
  if (!node) return fail('Not found.', epoch);

  const inUse =
    node._count.children > 0 ||
    node._count.usersInDivision > 0 ||
    node._count.usersInSubDivision > 0 ||
    node._count.usersInSection > 0 ||
    node._count.tasks > 0;

  if (inUse) {
    return fail(
      'This division has people, children, or tasks attached. Move them out first.',
      epoch,
    );
  }

  try {
    await prisma.division.delete({ where: { id: parsed.data.id } });
    await audit(guard.userId, 'delete', 'division', parsed.data.id, { name: node.name }, {});

    if (node.kind === 'pmu' && node.pmuParentDivisionId) {
      const remainingPmus = await prisma.division.count({
        where: { pmuParentDivisionId: node.pmuParentDivisionId },
      });
      if (remainingPmus === 0) {
        await prisma.division.update({
          where: { id: node.pmuParentDivisionId },
          data: { hasPmu: false },
        });
      }
    }
  } catch (err) {
    console.error('deleteDivisionAction failed:', err);
    return fail('Could not delete.', epoch);
  }

  revalidateAll();
  return ok(epoch);
}

// ============================================================
// setUserSupervisorAction — drag-and-drop reassignment
// ============================================================

const setSupervisorSchema = z.object({
  userId: z.string().uuid(),
  supervisorId: z
    .union([z.literal(''), z.string().uuid()])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

async function wouldCreateCycle(userId: string, supervisorId: string): Promise<boolean> {
  let current: string | null = supervisorId;
  const seen = new Set<string>([userId]);
  while (current) {
    if (seen.has(current)) return true;
    seen.add(current);
    const next: { supervisorId: string | null } | null = await prisma.user.findUnique({
      where: { id: current },
      select: { supervisorId: true },
    });
    current = next?.supervisorId ?? null;
  }
  return false;
}

export async function setUserSupervisorAction(
  prev: AdminStructureState | undefined,
  formData: FormData,
): Promise<AdminStructureState> {
  const epoch = bump(prev);
  const guard = await requireSuperAdmin();
  if (!guard.ok) return fail(guard.error, epoch);

  const parsed = setSupervisorSchema.safeParse({
    userId: formData.get('userId'),
    supervisorId: formData.get('supervisorId'),
  });
  if (!parsed.success) return fail('Invalid input.', epoch);

  if (parsed.data.userId === parsed.data.supervisorId) {
    return fail('A user cannot supervise themselves.', epoch);
  }

  if (
    parsed.data.supervisorId &&
    (await wouldCreateCycle(parsed.data.userId, parsed.data.supervisorId))
  ) {
    return fail('This would create a reporting loop.', epoch);
  }

  const before = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { supervisorId: true },
  });
  if (!before) return fail('User not found.', epoch);
  if (before.supervisorId === parsed.data.supervisorId) return ok(epoch);

  try {
    await prisma.user.update({
      where: { id: parsed.data.userId },
      data: { supervisorId: parsed.data.supervisorId },
    });
    await audit(
      guard.userId,
      'hierarchy_change',
      'user',
      parsed.data.userId,
      { supervisorId: before.supervisorId },
      { supervisorId: parsed.data.supervisorId },
    );
  } catch (err) {
    console.error('setUserSupervisorAction failed:', err);
    return fail('Could not reassign.', epoch);
  }

  revalidateAll();
  return ok(epoch);
}
