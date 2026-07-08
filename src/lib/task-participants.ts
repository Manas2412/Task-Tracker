import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { getOfficeOfJsDivisionId } from '@/lib/engagements';
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

/** DB-backed wrapper: resolves the head + Office-of-JS ids, then delegates. */
export async function buildTaskParticipantWhere(
  task: ParticipantTask,
): Promise<Prisma.UserWhereInput> {
  const officeOfJsDivisionId = await getOfficeOfJsDivisionId();
  const headId =
    task.division.headUserId ??
    (task.division.kind === 'pmu'
      ? await getPmuParentDivisionHeadId(task.divisionId)
      : null);
  return buildTaskParticipantWhereFrom(task, headId, officeOfJsDivisionId);
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
