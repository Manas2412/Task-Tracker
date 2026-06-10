'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

/**
 * Two-button segmented control per Design Tokens §7.6.
 * Flips between OSD's Command Centre and the Super Admin Console.
 * Active state derived from pathname (no internal state).
 *
 * Render decision lives in AppHeader: shows only when the caller has both
 * surfaces (Super Admin AND OSD/Super Admin's implicit OSD access).
 */
export function RoleSwitcher() {
  const pathname = usePathname() ?? '';
  const isAdmin = pathname.startsWith('/admin');

  return (
    <div
      role="tablist"
      aria-label="Role"
      className="hidden md:inline-flex items-center gap-0.5 p-[3px] bg-bg border border-line rounded-lg"
    >
      <Tab
        href="/command-centre"
        label="Command Centre"
        icon="ti-radar-2"
        active={!isAdmin}
      />
      <Tab
        href="/admin/structure"
        label="Super Admin"
        icon="ti-shield-lock"
        active={isAdmin}
      />
    </div>
  );
}

function Tab({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors',
        active
          ? 'bg-ink text-white'
          : 'text-ink-2 hover:text-ink hover:bg-line-2',
      )}
    >
      <i className={cn('ti', icon, 'text-[13px]')} aria-hidden="true" />
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
}
