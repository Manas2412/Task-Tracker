'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Sheet, Switch } from '@/components/ui';
import { resetUserPasswordAction } from '@/app/actions/admin-users';
import {
  INITIAL_ADMIN_USER_STATE,
  type AdminUserState,
} from '@/app/actions/states';
import { cn } from '@/lib/utils';

type ResetPasswordDialogProps = {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
};

export function ResetPasswordDialog({
  open,
  onClose,
  userId,
  userName,
}: ResetPasswordDialogProps) {
  const [state, formAction] = useFormState<AdminUserState, FormData>(
    resetUserPasswordAction,
    INITIAL_ADMIN_USER_STATE,
  );

  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Reset password"
      subtitle={`Sets a new password for ${userName}. Share it offline.`}
    >
      {open ? (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="userId" value={userId} />

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-ink-2">New password</span>
            <input
              name="newPassword"
              type="text"
              minLength={8}
              maxLength={200}
              required
              autoComplete="off"
              className={cn(
                'w-full px-3 py-2 rounded-lg border bg-panel text-[13px] text-ink font-mono outline-none transition-colors',
                state.fieldErrors?.newPassword
                  ? 'border-urgent focus:border-urgent'
                  : 'border-line focus:border-ink',
              )}
            />
            {state.fieldErrors?.newPassword ? (
              <span className="text-[11px] text-urgent">{state.fieldErrors.newPassword}</span>
            ) : (
              <span className="text-[11px] text-ink-3">At least 8 characters.</span>
            )}
          </label>

          <label className="mt-1 flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-line">
            <span className="text-[12px] text-ink">
              Force password change on next sign-in
            </span>
            <Switch
              name="forceChange"
              defaultChecked={true}
              ariaLabel="Force password change on next sign-in"
            />
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
            <ApplyButton />
          </div>
        </form>
      ) : null}
    </Sheet>
  );
}

function ApplyButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-2.5 rounded-lg bg-ink text-white text-[13px] font-medium disabled:opacity-60"
    >
      {pending ? 'Resetting…' : 'Reset password'}
    </button>
  );
}
