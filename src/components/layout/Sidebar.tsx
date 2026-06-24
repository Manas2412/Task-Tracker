'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

/**
 * Side navigation.
 *
 * Visibility:
 *   - mobile (< md)  : hidden (rendered inside MobileNavDrawer instead)
 *   - tablet (md..lg): icons only, 64px wide
 *   - laptop (lg+)   : labels visible, 240px wide
 *
 * Phase markers: items the user can navigate to today have full colour.
 * Items for upcoming phases get a "Soon" pill and are still clickable
 * (they land on the "Coming soon" placeholder).
 */

type Item = {
  href: string;
  label: string;
  icon: string;
  phase?: 1 | 2 | 3 | 4;
  adminOnly?: boolean;
};

const PRIMARY_ITEMS: Item[] = [
  { href: '/tasks', label: 'Tasks', icon: 'ti-checklist', phase: 1 },
  { href: '/priority-board', label: 'Priority board', icon: 'ti-layout-kanban', phase: 1 },
  { href: '/timeline-files', label: 'Timeline files', icon: 'ti-file-stack', phase: 1 },
  { href: '/calendar', label: 'Calendar', icon: 'ti-calendar', phase: 1 },
  { href: '/notifications', label: 'Notifications', icon: 'ti-bell', phase: 1 },
  { href: '/profile', label: 'Profile', icon: 'ti-user', phase: 1 },
];

const ADMIN_ITEMS: Item[] = [
  { href: '/admin/structure', label: 'Structure & hierarchy', icon: 'ti-sitemap', phase: 1, adminOnly: true },
  { href: '/admin/users', label: 'Users', icon: 'ti-users', phase: 1, adminOnly: true },
];

type SidebarProps = {
  isSuperAdmin: boolean;
  /** OSD or Super Admin — gates Command Centre */
  isOsd: boolean;
  /** JS slot — gates JS Dashboard */
  isJs: boolean;
  /** mobile drawer mode renders labels regardless of breakpoint */
  drawerMode?: boolean;
  onNavigate?: () => void;
};

const COMMAND_CENTRE_ITEM: Item = {
  href: '/command-centre',
  label: 'Command Centre',
  icon: 'ti-radar-2',
  phase: 1,
};

const JS_DASHBOARD_ITEM: Item = {
  href: '/js-dashboard',
  label: 'JS Dashboard',
  icon: 'ti-bookmark-filled',
  phase: 1,
};

export function Sidebar({
  isSuperAdmin,
  isOsd,
  isJs,
  drawerMode = false,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'flex flex-col gap-1 py-4',
        drawerMode ? 'px-3' : 'px-2 lg:px-3',
      )}
    >
      <Group label="Workspace" drawerMode={drawerMode} />
      {isOsd ? (
        <NavItem
          item={COMMAND_CENTRE_ITEM}
          active={isActive(pathname, COMMAND_CENTRE_ITEM.href)}
          drawerMode={drawerMode}
          onClick={onNavigate}
        />
      ) : null}
      {isJs && !isOsd ? (
        <NavItem
          item={JS_DASHBOARD_ITEM}
          active={isActive(pathname, JS_DASHBOARD_ITEM.href)}
          drawerMode={drawerMode}
          onClick={onNavigate}
        />
      ) : null}
      {PRIMARY_ITEMS.map((item) => (
        <NavItem
          key={item.href}
          item={item}
          active={isActive(pathname, item.href)}
          drawerMode={drawerMode}
          onClick={onNavigate}
        />
      ))}

      {isSuperAdmin ? (
        <>
          <Group label="Super Admin" drawerMode={drawerMode} className="mt-4" />
          {ADMIN_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
              drawerMode={drawerMode}
              onClick={onNavigate}
            />
          ))}
        </>
      ) : null}
    </nav>
  );
}

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === '/tasks') return pathname === '/tasks' || pathname.startsWith('/tasks/');
  return pathname === href || pathname.startsWith(href + '/');
}

function NavItem({
  item,
  active,
  drawerMode,
  onClick,
}: {
  item: Item;
  active: boolean;
  drawerMode: boolean;
  onClick?: () => void;
}) {
  const soon = item.phase && item.phase > 1;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg transition-colors',
        drawerMode ? 'px-3 py-2.5' : 'px-2.5 py-2 lg:px-3 lg:py-2.5',
        active
          ? 'bg-primary-soft text-primary'
          : 'text-ink-2 hover:bg-line-2 hover:text-ink',
      )}
    >
      <i
        className={cn(
          'ti',
          item.icon,
          'text-[18px] shrink-0',
          active ? 'text-primary' : 'text-ink-3 group-hover:text-ink-2',
        )}
        aria-hidden="true"
      />
      <span
        className={cn(
          'text-[13px] font-medium leading-none flex-1',
          drawerMode ? 'block' : 'hidden lg:block',
        )}
      >
        {item.label}
      </span>
      {soon ? (
        <span
          className={cn(
            'text-[9px] uppercase tracking-[0.06em] font-medium px-1.5 py-0.5 rounded-md bg-line-2 text-ink-3',
            drawerMode ? 'block' : 'hidden lg:block',
          )}
        >
          Soon
        </span>
      ) : null}
    </Link>
  );
}

function Group({
  label,
  drawerMode,
  className,
}: {
  label: string;
  drawerMode: boolean;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        'text-[9px] uppercase tracking-[0.1em] text-ink-3 font-medium px-3 mb-1',
        drawerMode ? 'block' : 'hidden lg:block',
        className,
      )}
    >
      {label}
    </h2>
  );
}
