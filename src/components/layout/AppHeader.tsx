'use client';

import Link from 'next/link';

import { AnalyticsBadge } from '../AnalyticsBadge';
import { NotificationsBell, type BellNotification } from './NotificationsBell';
import { RoleSwitcher } from './RoleSwitcher';
import { SearchField } from './SearchField';
import { UserMenu } from './UserMenu';

type AppHeaderProps = {
  onOpenDrawer: () => void;
  notifications: {
    unreadCount: number;
    recent: BellNotification[];
  };
  user: {
    name: string;
    initials: string;
    colour: string;
    designation: string;
    canSwitchRole: boolean;
  };
};

export function AppHeader({ onOpenDrawer, notifications, user }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 bg-bg/80 backdrop-blur-sm border-b border-line-2">
      <div className="px-4 md:px-6 h-14 md:h-16 flex items-center gap-3 md:gap-4">
        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onOpenDrawer}
          className="md:hidden w-9 h-9 grid place-items-center rounded-full text-ink-2 hover:bg-line-2"
        >
          <i className="ti ti-menu-2 text-[20px]" aria-hidden="true" />
        </button>

        {/* Brand */}
        <div className="flex items-baseline gap-2 md:gap-3 mr-auto md:mr-0 min-w-0">
          <h1 className="font-serif text-[20px] md:text-[22px] leading-none text-ink truncate">
            Tasks
          </h1>
          <span className="hidden md:inline text-[10px] tracking-[0.12em] uppercase text-ink-3 font-medium border-l border-line pl-3">
            Ministry of Y. A. &amp; Sports
          </span>
        </div>

        {/* Mobile search icon */}
        <Link
          href="/search"
          aria-label="Search"
          className="md:hidden w-9 h-9 grid place-items-center rounded-full text-ink-2 hover:bg-line-2"
        >
          <i className="ti ti-search text-[20px]" aria-hidden="true" />
        </Link>

        {/* Global search — tablet+ */}
        <SearchField />

        {user.canSwitchRole ? <RoleSwitcher /> : null}

        <div className="hidden md:block">
          <AnalyticsBadge />
        </div>

        <NotificationsBell
          unreadCount={notifications.unreadCount}
          recent={notifications.recent}
        />

        <UserMenu user={user} />
      </div>
    </header>
  );
}
