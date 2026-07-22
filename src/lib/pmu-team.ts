import { prisma } from '@/lib/db';

/**
 * PMU team-leader admin scope.
 *
 * A PMU is a vendor team embedded in a ministry division: its members are
 * ordinary users flagged `is_pmu = true` with a `pmu_role`, homed in that
 * division. One of them holds `pmu_role = 'pmu_team_leader'` and leads the
 * team. This module resolves that leader's team so the task gates can grant
 * them admin — edit, reassign, attach, and collaborator management — over the
 * PMU team's tasks (and ONLY the PMU team's: never the wider division's
 * ministry tasks, and never delete). See PERMISSIONS.md.
 */

export const PMU_TEAM_LEADER_ROLE = 'pmu_team_leader';

/** The identifying facts for the leader check — nullable to match the schema. */
export type PmuMembership = {
  isActive: boolean;
  isPmu: boolean;
  pmuRole: string | null;
};

/** An active PMU team leader — the only role this admin scope is granted to. */
export function isPmuTeamLeader(user: PmuMembership): boolean {
  return user.isActive && user.isPmu && user.pmuRole === PMU_TEAM_LEADER_ROLE;
}

/**
 * The user ids forming `userId`'s PMU team — every active PMU member sharing
 * their division and PMU attachment (`pmu_id`, which is `null` for the common
 * "flagged member in a normal division" case and matched as such). The leader
 * themselves is included, which is harmless: a leader always manages their own
 * tasks via ownership. Returns `[]` when the user is not an ACTIVE PMU team
 * leader, so a non-leader caller is a no-op everywhere this feeds.
 *
 * The team is deliberately scoped to `is_pmu` members only, so a leader never
 * gains any power over the division's non-PMU ministry tasks.
 */
export async function getPmuTeamMemberIds(userId: string): Promise<string[]> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, isPmu: true, pmuRole: true, divisionId: true, pmuId: true },
  });
  if (!me || !isPmuTeamLeader(me)) return [];

  const team = await prisma.user.findMany({
    where: {
      isActive: true,
      isPmu: true,
      divisionId: me.divisionId,
      // Matches null-to-null (flagged members with no explicit attachment) and
      // value-to-value (members attached to a specific PMU division).
      pmuId: me.pmuId,
    },
    select: { id: true },
  });
  return team.map((u) => u.id);
}
