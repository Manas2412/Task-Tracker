import { redirect } from 'next/navigation';

import { AppShell, type BellNotification } from '@/components/layout';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { initialsOf } from '@/lib/format';
import { buildNotificationTaskContext } from '@/lib/notification-context';
import { getHeadedDivisionIds } from '@/lib/rbac';
import { isS3Configured } from '@/lib/s3';

import {
  QuickCreateFab,
  QuickCreateProvider,
} from './tasks/_components/QuickCreate';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [me, unreadCount, recentRaw, headedDivisionIds] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: { division: true },
    }),
    prisma.notification.count({
      where: { userId: session.user.id, readAt: null },
    }),
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        type: true,
        payload: true,
        readAt: true,
        createdAt: true,
      },
    }),
    getHeadedDivisionIds(session.user.id),
  ]);
  if (!me) redirect('/login');

  // Quick Create targets the user's home division, so the Division
  // visibility option is offered only to those who can give tasks there:
  // Super Admin, OSD, the division's head, or an active delegate.
  const canCreateDivisionTasks =
    me.isSuperAdmin ||
    me.hierarchySlot === 'osd' ||
    headedDivisionIds.includes(me.divisionId);

  // Divisions + PMUs the caller may target when creating a division task
  // (Structure & Hierarchy). Ownership auto-resolves to that division's head
  // — or a PMU's team leader — on the server. Super Admin / OSD see all;
  // a head sees the divisions they head plus those divisions' PMUs.
  const createTargets = canCreateDivisionTasks
    ? await prisma.division.findMany({
        where:
          me.isSuperAdmin || me.hierarchySlot === 'osd'
            ? { kind: { in: ['division', 'pmu'] } }
            : {
                OR: [
                  { id: { in: headedDivisionIds } },
                  { kind: 'pmu', pmuParentDivisionId: { in: headedDivisionIds } },
                ],
              },
        orderBy: [{ kind: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, kind: true },
      })
    : [];

  // Active members of those targets, so a head can optionally name an initial
  // owner in Quick Create (leaving it blank keeps the unassigned / PMU-leader
  // default). Only division-task creators see the picker, so only they need
  // the pool. A division's members have divisionId === target; a PMU's members
  // have pmuId === target.
  const divisionTargetIds = createTargets.filter((t) => t.kind !== 'pmu').map((t) => t.id);
  const pmuTargetIds = createTargets.filter((t) => t.kind === 'pmu').map((t) => t.id);
  const ownerCandidates =
    canCreateDivisionTasks && createTargets.length > 0
      ? (
          await prisma.user.findMany({
            where: {
              isActive: true,
              OR: [
                { divisionId: { in: divisionTargetIds } },
                { pmuId: { in: pmuTargetIds } },
              ],
            },
            orderBy: { name: 'asc' },
            select: {
              id: true,
              name: true,
              designation: true,
              divisionId: true,
              pmuId: true,
              division: { select: { name: true, avatarColour: true } },
            },
          })
        ).map((u) => ({
          id: u.id,
          name: u.name,
          designation: u.designation,
          divisionId: u.divisionId,
          pmuId: u.pmuId,
          divisionName: u.division.name,
          divisionColour: u.division.avatarColour,
        }))
      : [];

  const taskContext = await buildNotificationTaskContext(recentRaw);

  const recent: BellNotification[] = recentRaw.map((n) => ({
    id: n.id,
    type: n.type,
    payload: n.payload as Record<string, unknown> | null,
    readAt: n.readAt,
    createdAt: n.createdAt,
    taskContext: taskContext.get(n.id),
  }));

  const isOsd = me.hierarchySlot === 'osd' || me.isSuperAdmin;
  const isJs = me.hierarchySlot === 'js' || isOsd;
  const canSwitchRole = isOsd && me.isSuperAdmin;
  // Tour report (external platform) — Super Admins plus the osd.myas
  // account specifically, which is narrower than the OSD-slot gate.
  const showTourReport = me.isSuperAdmin || me.username === 'osd.myas';

  return (
    <AppShell
      user={{
        name: me.name,
        initials: initialsOf(me.name),
        colour: me.division.avatarColour,
        designation: me.designation,
        isSuperAdmin: me.isSuperAdmin,
        isOsd,
        isJs,
        showTourReport,
        canSwitchRole,
      }}
      notifications={{ unreadCount, recent }}
    >
      <QuickCreateProvider
        defaultDivisionId={me.divisionId}
        s3Configured={isS3Configured()}
        canCreateDivisionTasks={canCreateDivisionTasks}
        createTargets={createTargets}
        ownerCandidates={ownerCandidates}
      >
        {children}
        <QuickCreateFab />
      </QuickCreateProvider>
    </AppShell>
  );
}
