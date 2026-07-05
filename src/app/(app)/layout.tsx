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

  const [me, unreadCount, recentRaw] = await Promise.all([
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
  ]);
  if (!me) redirect('/login');

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

  // Division-level tasks are a head power: only the head of the user's own
  // division (direct or via an active delegation), OSD, or Super Admin may
  // create tasks the whole division sees. Everyone else creates personal
  // tasks. The server enforces this too; this just tailors Quick Create.
  const headedDivisionIds = await getHeadedDivisionIds(me.id);
  const canCreateDivisionTasks =
    me.isSuperAdmin || me.hierarchySlot === 'osd' || headedDivisionIds.includes(me.divisionId);
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
      >
        {children}
        <QuickCreateFab />
      </QuickCreateProvider>
    </AppShell>
  );
}
