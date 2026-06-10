'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

/**
 * Six-tab sub-navigation across the admin console.
 * All tabs are functional — Structure, Users, Tags, Audit (Phase 1+3),
 * Bulk import and Settings (Phase 4).
 */

type Tab = {
  href: string;
  label: string;
  icon: string;
  phase: 1 | 3 | 4;
};

const TABS: Tab[] = [
  { href: '/admin/structure', label: 'Structure & hierarchy', icon: 'ti-sitemap', phase: 1 },
  { href: '/admin/users', label: 'Users', icon: 'ti-users', phase: 1 },
  { href: '/admin/tags', label: 'Tags & labels', icon: 'ti-tags', phase: 1 },
  { href: '/admin/audit', label: 'Audit trail', icon: 'ti-history', phase: 1 },
  { href: '/admin/import', label: 'Bulk import', icon: 'ti-upload', phase: 1 },
  { href: '/admin/settings', label: 'Settings', icon: 'ti-settings', phase: 1 },
];

export function AdminSubNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Super Admin sections"
      className="px-2 md:px-4 lg:px-6 flex gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden"
    >
      {TABS.map((tab) => {
        const isActive = pathname?.startsWith(tab.href);
        const isSoon = tab.phase > 1;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'group inline-flex items-center gap-1.5 px-3 py-2.5 text-[12.5px] font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
              isActive
                ? 'text-ink border-ink'
                : 'text-ink-2 hover:text-ink border-transparent',
            )}
          >
            <i className={cn('ti', tab.icon, 'text-[14px]')} aria-hidden="true" />
            {tab.label}
            {isSoon ? (
              <span className="ml-1 text-[9px] uppercase tracking-[0.06em] font-medium px-1.5 py-0.5 rounded-md bg-line-2 text-ink-3 group-hover:bg-bg">
                Soon
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
