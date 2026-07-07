'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { EditUserDialog } from './EditUserDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';
import {
  setUserActiveAction,
  changeDivisionAction,
  deleteUserAction,
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
    username: string;
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
  const [deleteOpen, setDeleteOpen] = useState(false);
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
      <div className="flex items-center gap-1 justify-end">
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
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-ink-2 hover:text-ink hover:bg-line-2 transition-colors"
          >
            <i className="ti ti-pencil text-[14px]" aria-hidden="true" />
            Edit
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
                You cannot disable or delete your own account.
              </div>
            ) : (
              <>
                <MenuButton
                  icon={user.isActive ? 'ti-user-off' : 'ti-user-check'}
                  label={user.isActive ? 'Disable user' : 'Enable user'}
                  danger={user.isActive}
                  onClick={toggleActive}
                  disabled={pending}
                />
                <div className="my-1 border-t border-line-2" />
                <MenuButton
                  icon="ti-trash"
                  label="Delete user"
                  danger
                  onClick={() => {
                    setOpen(false);
                    setDeleteOpen(true);
                  }}
                />
              </>
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

      {divisionOpen ? (
        <ChangeDivisionOverlay
          onClose={() => setDivisionOpen(false)}
          userId={user.id}
          userName={user.name}
          currentDivisionId={user.divisionId}
          divisions={topDivisions}
        />
      ) : null}

      {deleteOpen ? (
        <DeleteUserOverlay
          onClose={() => setDeleteOpen(false)}
          userId={user.id}
          username={user.username}
          userName={user.name}
        />
      ) : null}
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
// Delete-user confirmation overlay — requires re-typing the username
// ------------------------------------------------------------

function DeleteUserOverlay({
  onClose,
  userId,
  username,
  userName,
}: {
  onClose: () => void;
  userId: string;
  username: string;
  userName: string;
}) {
  const [confirm, setConfirm] = useState('');
  const [deleting, startDeleting] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const matches = confirm.trim().toLowerCase() === username.toLowerCase();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const handleDelete = () => {
    if (!matches || deleting) return;
    setError(null);
    const fd = new FormData();
    fd.set('userId', userId);
    fd.set('confirmUsername', confirm);
    startDeleting(async () => {
      const result = await deleteUserAction(undefined, fd);
      if (result.ok) {
        onClose();
      } else {
        setError(result.error ?? 'Could not delete the user.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-panel rounded-2xl border border-line shadow-2xl w-full max-w-[440px] mx-4 p-5">
        <div className="flex items-start gap-3 mb-3">
          <span className="mt-0.5 w-9 h-9 shrink-0 grid place-items-center rounded-full bg-urgent-soft text-urgent">
            <i className="ti ti-trash text-[18px]" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-serif text-[18px] text-ink">Delete {userName}</h3>
            <p className="text-[12px] text-ink-3">This permanently removes the account.</p>
          </div>
        </div>

        <div className="rounded-lg border border-urgent/20 bg-urgent-soft px-3 py-2.5 mb-4">
          <p className="text-[12px] text-ink-2 leading-relaxed">
            Their tasks, Timeline Files, comments, and history are reassigned to{' '}
            <span className="font-medium text-ink">you</span>, and they are removed from every
            board and division. This <span className="font-medium text-urgent">cannot be undone</span>
            {' '}— use <span className="font-medium">Disable</span> instead to keep the account and its records.
          </p>
        </div>

        <label className="flex flex-col gap-1 mb-3">
          <span className="text-[11px] font-medium text-ink-2">
            Type <span className="font-mono text-ink">{username}</span> to confirm
          </span>
          <input
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleDelete();
              }
            }}
            className="w-full px-3 py-2 rounded-lg border border-line bg-bg text-[13px] font-mono text-ink outline-none focus:border-urgent"
          />
        </label>

        {error ? (
          <p
            role="alert"
            className="text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2 mb-3"
          >
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-line text-[13px] font-medium text-ink-2 hover:bg-line-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!matches || deleting}
            className="flex-1 py-2.5 rounded-lg bg-urgent text-white text-[13px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Lightweight overlay for changing division (no Sheet dependency)
// ------------------------------------------------------------

function ChangeDivisionOverlay({
  onClose,
  userId,
  userName,
  currentDivisionId,
  divisions,
}: {
  onClose: () => void;
  userId: string;
  userName: string;
  currentDivisionId: string;
  divisions: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState(currentDivisionId);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const handleSave = () => {
    if (selected === currentDivisionId) {
      onClose();
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set('userId', userId);
    fd.set('divisionId', selected);
    startSaving(async () => {
      const result = await changeDivisionAction(undefined, fd);
      if (result.ok) {
        onClose();
      } else {
        setError(result.error ?? 'Could not change division.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div className="relative bg-panel rounded-2xl border border-line shadow-2xl w-full max-w-[420px] mx-4 p-5">
        <h3 className="font-serif text-[18px] text-ink mb-1">Change division</h3>
        <p className="text-[12px] text-ink-3 mb-4">
          Reassign {userName} to a different division.
        </p>

        <label className="flex flex-col gap-1 mb-3">
          <span className="text-[11px] font-medium text-ink-2">Division</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-line bg-bg text-[13px] text-ink outline-none focus:border-ink"
          >
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        {error ? (
          <p
            role="alert"
            className="text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2 mb-3"
          >
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-line text-[13px] font-medium text-ink-2 hover:bg-line-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-ink text-white text-[13px] font-medium disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
