'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Sheet } from '@/components/ui/Sheet';
import { EditUserDialog } from './EditUserDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';
import {
  setUserActiveAction,
  changeDivisionAction,
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
    divisionId: string;
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
  const [divisionOpen, setDivisionOpen] = useState(false);
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

  const topDivisions = divisions.filter((d) => d.kind === 'division');

  return (
    <>
      <div className="flex items-center gap-1">
        {/* Always-visible activate/deactivate toggle */}
        {!isSelf ? (
          <button
            type="button"
            onClick={toggleActive}
            disabled={pending}
            title={user.isActive ? 'Disable user' : 'Enable user'}
            className={cn(
              'w-8 h-8 grid place-items-center rounded-full border transition-colors disabled:opacity-60',
              user.isActive
                ? 'text-urgent border-urgent/20 bg-urgent-soft hover:bg-urgent/10'
                : 'text-success border-success/20 bg-success-soft hover:bg-success/10',
            )}
          >
            <i
              className={cn('ti text-[16px]', user.isActive ? 'ti-user-off' : 'ti-user-check')}
              aria-hidden="true"
            />
          </button>
        ) : null}

        {/* Dropdown menu for other actions */}
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
              icon="ti-arrows-transfer-down"
              label="Change division"
              onClick={() => {
                setOpen(false);
                setDivisionOpen(true);
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

      <ChangeDivisionDialog
        open={divisionOpen}
        onClose={() => setDivisionOpen(false)}
        userId={user.id}
        userName={user.name}
        currentDivisionId={user.divisionId}
        divisions={topDivisions}
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

// ------------------------------------------------------------
// Change Division dialog
// ------------------------------------------------------------

function ChangeDivisionDialog({
  open,
  onClose,
  userId,
  userName,
  currentDivisionId,
  divisions,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  currentDivisionId: string;
  divisions: { id: string; name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(changeDivisionAction, {
    ok: false,
    epoch: 0,
  });

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Change division"
      subtitle={`Reassign ${userName} to a different division.`}
    >
      {open ? (
        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="userId" value={userId} />

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-ink-2">Division</span>
            <select
              name="divisionId"
              defaultValue={currentDivisionId}
              className="w-full px-3 py-2 rounded-lg border border-line bg-panel text-[13px] text-ink outline-none focus:border-ink"
            >
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          {state.error ? (
            <p
              role="alert"
              className="text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2"
            >
              {state.error}
            </p>
          ) : null}

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-line text-[13px] font-medium text-ink-2 hover:bg-line-2"
            >
              Cancel
            </button>
            <SubmitButton />
          </div>
        </form>
      ) : null}
    </Sheet>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-2.5 rounded-lg bg-ink text-white text-[13px] font-medium disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}
