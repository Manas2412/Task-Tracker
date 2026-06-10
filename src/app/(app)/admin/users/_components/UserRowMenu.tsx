'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { EditUserDialog } from './EditUserDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';
import {
  setUserActiveAction,
} from '@/app/actions/admin-users';
import { cn } from '@/lib/utils';

import type {
  UserFormDefaults,
  UserFormDivisionOption,
  UserFormSupervisorOption,
} from './UserFormFields';

type UserRowMenuProps = {
  user: {
    id: string;
    name: string;
    isActive: boolean;
    defaults: UserFormDefaults;
  };
  divisions: UserFormDivisionOption[];
  supervisors: UserFormSupervisorOption[];
  isSelf: boolean;
};

export function UserRowMenu({ user, divisions, supervisors, isSelf }: UserRowMenuProps) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
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

  const toggleActive = () => {
    setOpen(false);
    const fd = new FormData();
    fd.set('userId', user.id);
    fd.set('isActive', user.isActive ? 'false' : 'true');
    startTransition(async () => {
      const result = await setUserActiveAction(undefined, fd);
      if (!result.ok && result.error) alert(result.error);
    });
  };

  return (
    <>
      <div className="relative" ref={wrapRef}>
        <button
          type="button"
          aria-label={`Actions for ${user.name}`}
          onClick={() => setOpen((v) => !v)}
          className="w-8 h-8 grid place-items-center rounded-full text-ink-2 hover:bg-line-2"
        >
          <i className="ti ti-dots-vertical text-[16px]" aria-hidden="true" />
        </button>

        <div
          role="menu"
          aria-hidden={!open}
          className={cn(
            'absolute right-0 top-full mt-2 w-56 rounded-xl border border-line bg-panel shadow-xl z-40 p-1.5',
            'transition-all duration-150 origin-top-right',
            open
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 scale-95 pointer-events-none',
          )}
        >
          <MenuButton
            icon="ti-edit"
            label="Edit details"
            onClick={() => {
              setOpen(false);
              setEditOpen(true);
            }}
          />
          <MenuButton
            icon="ti-lock-cog"
            label="Reset password"
            onClick={() => {
              setOpen(false);
              setResetOpen(true);
            }}
          />
          {isSelf ? (
            <div className="px-3 py-1.5 text-[10px] text-ink-3">
              You cannot disable your own account.
            </div>
          ) : (
            <MenuButton
              icon={user.isActive ? 'ti-user-off' : 'ti-user-check'}
              label={user.isActive ? 'Disable user' : 'Enable user'}
              danger={user.isActive}
              onClick={toggleActive}
              disabled={pending}
            />
          )}
        </div>
      </div>

      <EditUserDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        userId={user.id}
        defaults={user.defaults}
        divisions={divisions}
        supervisors={supervisors}
      />

      <ResetPasswordDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        userId={user.id}
        userName={user.name}
      />
    </>
  );
}

function MenuButton({
  icon,
  label,
  danger,
  onClick,
  disabled,
}: {
  icon: string;
  label: string;
  danger?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] hover:bg-bg transition-colors disabled:opacity-60',
        danger ? 'text-urgent' : 'text-ink',
      )}
    >
      <i
        className={cn('ti', icon, 'text-[16px]', danger ? 'text-urgent' : 'text-ink-2')}
        aria-hidden="true"
      />
      {label}
    </button>
  );
}
