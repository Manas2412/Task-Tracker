'use client';

import { useState } from 'react';

import type { BellNotification } from './NotificationsBell';

import { AppHeader } from './AppHeader';
import { MobileNavDrawer } from './MobileNavDrawer';
import { Sidebar } from './Sidebar';

type AppShellProps = {
  user: {
    name: string;
    initials: string;
    colour: string;
    designation: string;
    isSuperAdmin: boolean;
    /** OSD slot OR Super Admin — gates Command Centre */
    isOsd: boolean;
    /** Show RoleSwitcher when the caller has both Command Centre and Super Admin */
    canSwitchRole: boolean;
  };
  notifications: {
    unreadCount: number;
    recent: BellNotification[];
  };
  /** Optional primary action shown in the page header area (e.g. "+ New task") */
  primaryAction?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * The responsive app shell.
 *
 * Grid layout at md+:
 *
 *   ┌────────────────────────────────────────────┐
 *   │                  AppHeader                 │
 *   ├──────────┬─────────────────────────────────┤
 *   │ Sidebar  │           children              │
 *   │ (icons   │                                 │
 *   │ on md,   │                                 │
 *   │ labels   │                                 │
 *   │ on lg)   │                                 │
 *   └──────────┴─────────────────────────────────┘
 *
 * On mobile the sidebar disappears and reopens as a drawer triggered
 * by the hamburger in the header.
 */
export function AppShell({
  user,
  notifications,
  primaryAction,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      <AppHeader
        onOpenDrawer={() => setDrawerOpen(true)}
        notifications={notifications}
        user={user}
      />

      <MobileNavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        isSuperAdmin={user.isSuperAdmin}
        isOsd={user.isOsd}
      />

      <div className="flex-1 grid md:grid-cols-[64px_1fr] lg:grid-cols-[240px_1fr]">
        {/* Sidebar — visible md+ only */}
        <aside
          aria-label="Primary navigation"
          className="hidden md:block border-r border-line bg-panel"
        >
          <div className="sticky top-16">
            <Sidebar isSuperAdmin={user.isSuperAdmin} isOsd={user.isOsd} />
          </div>
        </aside>

        {/* Main content with optional primary action floating top-right */}
        <main className="relative min-w-0">
          {primaryAction ? (
            <div className="hidden md:flex absolute top-3 right-4 lg:right-6 z-10">
              {primaryAction}
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
