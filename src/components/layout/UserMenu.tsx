'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import { Avatar } from '@/components/ui/Avatar';
import { signOutAction } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

type UserMenuProps = {
  user: {
    name: string;
    initials: string;
    colour: string;
    designation: string;
  };
};

export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Account menu for ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-full focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
      >
        <Avatar
          initials={user.initials}
          colour={user.colour}
          size="md"
          ariaLabel={user.name}
        />
      </button>

      <div
        role="menu"
        aria-hidden={!open}
        className={cn(
          'absolute right-0 top-full mt-2 w-64 rounded-xl border border-line bg-panel shadow-xl',
          'transition-all duration-150 origin-top-right',
          open
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-95 pointer-events-none',
        )}
      >
        <div className="px-3.5 py-3 border-b border-line-2">
          <div className="text-[13px] font-medium text-ink leading-tight">{user.name}</div>
          <div className="text-[11px] text-ink-3 mt-0.5">{user.designation}</div>
        </div>

        <div className="p-1.5">
          <MenuLink href="/profile" icon="ti-user" label="Profile" onSelect={() => setOpen(false)} />
          <MenuLink
            href="/profile/change-password"
            icon="ti-lock-cog"
            label="Change password"
            onSelect={() => setOpen(false)}
          />
        </div>

        <form action={signOutAction} className="p-1.5 border-t border-line-2">
          <button
            type="submit"
            role="menuitem"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-ink hover:bg-line-2 transition-colors"
          >
            <i className="ti ti-logout text-[16px] text-ink-2" aria-hidden="true" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

function MenuLink({
  href,
  icon,
  label,
  onSelect,
}: {
  href: string;
  icon: string;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onSelect}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-ink hover:bg-line-2 transition-colors"
    >
      <i className={cn('ti', icon, 'text-[16px] text-ink-2')} aria-hidden="true" />
      {label}
    </Link>
  );
}
