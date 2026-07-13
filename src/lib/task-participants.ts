import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { getOfficeOfJsDivisionId } from '@/lib/engagements';
import { getLinkedParticipantDivisionIds } from '@/lib/rbac';
import { getPmuParentDivisionHeadId } from '@/lib/visibility';

/**
 * Who may take part in a task — the single source of truth for every task
 * user-picker (collaborators, subtask assignees, @mentions) and its
 * server-side guard, so the pickers and the actions never diverge.
 *
 * A task's participants are the active users of its division (or, for a PMU
 * task, its PMU team), that division's head, and the always-relevant
 * oversight roles (OSD + Super Admin). The seeded "Office of JS" division is
 * a coordinating office, so its tasks may involve any active user.
 *
 * On top of that, members of any division cross-linked for participation
 * (`CROSS_DIVISION_PARTICIPANT_LINKS` in src/lib/rbac — e.g. Khelo India / Khelo
 * India Mission ↔ NSDF, both directions) are folded in, so the cross-division
 * reach applies uniformly to collaborators, subtask assignees, and @mentions in
 * the discussion. The link grants participant reach only — no head powers, no
 * visibility of the other division's board. See PERMISSIONS §5.17.
 *
 * The task OWNER is deliberately stricter (same division only — see
 * createTaskAction) and is not built from this rule.
 */

export type ParticipantTask = {
  divisionId: string;
  division: { kind: string; headUserId: string | null };
};

/**
 * Pure core — given the resolved division head id and the Office-of-JS
 * division id, build the `where` that selects a task's participants.
 * Unit-testable without a database.
 */
export function buildTaskParticipantWhereFrom(
  task: ParticipantTask,
  headId: string | null,
  officeOfJsDivisionId: string | null,
): Prisma.UserWhereInput {
  // Office of JS coordinates across the ministry — any active user qualifies.
  if (officeOfJsDivisionId && task.divisionId === officeOfJsDivisionId) {
    return { isActive: true };
  }

  const isPmu = task.division.kind === 'pmu';
  const or: Prisma.UserWhereInput[] = [
    // Members of the task's division — or, for a PMU task, its team.
    isPmu ? { pmuId: task.divisionId } : { divisionId: task.divisionId },
    // Oversight roles are relevant to every task.
    { hierarchySlot: 'osd' },
    { isSuperAdmin: true },
  ];
  // The division's head (may sit in a different home division).
  if (headId) or.push({ id: headId });

  return { isActive: true, OR: or };
}

/**
 * DB-backed wrapper: resolves the head + Office-of-JS ids to build the base
 * participant set, then folds in members of any cross-linked division
 * (`CROSS_DIVISION_PARTICIPANT_LINKS`, e.g. Khelo India / Khelo India Mission ↔
 * NSDF). The single source every task user-picker and guard reads, so the
 * cross-division reach lands on collaborators, subtask assignees, and @mentions
 * alike.
 */
export async function buildTaskParticipantWhere(
  task: ParticipantTask,
): Promise<Prisma.UserWhereInput> {
  const [officeOfJsDivisionId, linkedDivisionIds] = await Promise.all([
    getOfficeOfJsDivisionId(),
    getLinkedParticipantDivisionIds(task.divisionId),
  ]);
  const headId =
    task.division.headUserId ??
    (task.division.kind === 'pmu'
      ? await getPmuParentDivisionHeadId(task.divisionId)
      : null);
  const base = buildTaskParticipantWhereFrom(task, headId, officeOfJsDivisionId);
  if (linkedDivisionIds.length === 0) return base;
  return { OR: [base, { isActive: true, divisionId: { in: linkedDivisionIds } }] };
}

/** Whether a user is allowed to take part in a task (server-side guard). */
export async function isTaskParticipant(
  userId: string,
  task: ParticipantTask,
): Promise<boolean> {
  const where = await buildTaskParticipantWhere(task);
  const count = await prisma.user.count({ where: { AND: [{ id: userId }, where] } });
  return count > 0;
}

/**
 * Whether a user is an explicit collaborator on a task — any collaborator
 * row (collaborator / division_lead / co_owner). Collaborators may
 * *contribute* to a task they can see (add documents, edit its context,
 * create subtasks) without owning or being able to redefine it. The
 * server-side guards for those contribute actions share this helper.
 */
export async function isTaskCollaborator(
  userId: string,
  taskId: string,
): Promise<boolean> {
  const row = await prisma.taskCollaborator.findFirst({
    where: { taskId, userId },
    select: { id: true },
  });
  return row !== null;
}
