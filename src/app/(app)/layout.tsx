import { redirect } from 'next/navigation';

import { AppShell, type BellNotification } from '@/components/layout';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { initialsOf } from '@/lib/format';

/**
 * In-app route-group layout.
 * Wraps every Phase 1/2/3 user-facing screen in the responsive AppShell.
 * The Super Admin Console lives at admin/ and adds its own sub-chrome on top.
 *
 * Why this is a Server Component: it needs the caller's profile (name,
 * designation, division) plus their unread-notification count + recent
 * notifications for the bell. AppShell itself is a client component for
 * state (drawer open/closed); we pass the snapshot in.
 */
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
  // Role switcher appears only when both surfaces are accessible.
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
        canSwitchRole,
      }}
      notifications={{ unreadCount, recent }}
    >
      {children}
    </AppShell>
  );
}
