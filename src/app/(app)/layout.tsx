import { redirect } from 'next/navigation';

import { AppShell, type BellNotification } from '@/components/layout';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { initialsOf } from '@/lib/format';
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

  const recent: BellNotification[] = recentRaw.map((n) => ({
    id: n.id,
    type: n.type,
    payload: n.payload as Record<string, unknown> | null,
    readAt: n.readAt,
    createdAt: n.createdAt,
  }));

  const isOsd = me.hierarchySlot === 'osd' || me.isSuperAdmin;
  const isJs = me.hierarchySlot === 'js' || isOsd;
  const canSwitchRole = isOsd && me.isSuperAdmin;

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
        canSwitchRole,
      }}
      notifications={{ unreadCount, recent }}
    >
      <QuickCreateProvider defaultDivisionId={me.divisionId} s3Configured={isS3Configured()}>
        {children}
        <QuickCreateFab />
      </QuickCreateProvider>
    </AppShell>
  );
}
