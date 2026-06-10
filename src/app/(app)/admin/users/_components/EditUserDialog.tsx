'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Sheet } from '@/components/ui';
import { updateUserAction } from '@/app/actions/admin-users';
import {
  INITIAL_ADMIN_USER_STATE,
  type AdminUserState,
} from '@/app/actions/states';

import {
  UserFormFields,
  type UserFormDefaults,
  type UserFormDivisionOption,
  type UserFormSupervisorOption,
} from './UserFormFields';

type EditUserDialogProps = {
  open: boolean;
  onClose: () => void;
  userId: string;
  defaults: UserFormDefaults;
  divisions: UserFormDivisionOption[];
  supervisors: UserFormSupervisorOption[];
};

export function EditUserDialog({
  open,
  onClose,
  userId,
  defaults,
  divisions,
  supervisors,
}: EditUserDialogProps) {
  const [state, formAction] = useFormState<AdminUserState, FormData>(
    updateUserAction,
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
      title="Edit user"
      subtitle="Updates apply immediately. Audit log records the change."
    >
      {open ? (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="userId" value={userId} />

          <UserFormFields
            mode="edit"
            divisions={divisions}
            supervisors={supervisors.filter((s) => s.id !== userId)}
            defaults={defaults}
            fieldErrors={state.fieldErrors}
            identityLocked
          />

          {state.error ? (
            <p
              role="alert"
              className="text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2"
            >
              {state.error}
            </p>
          ) : null}

          <div className="flex gap-2 mt-1 sticky bottom-0 bg-panel pt-3 -mb-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-line text-[13px] font-medium text-ink-2 hover:bg-line-2"
            >
              Cancel
            </button>
            <SaveButton />
          </div>
        </form>
      ) : null}
    </Sheet>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-2.5 rounded-lg bg-ink text-white text-[13px] font-medium disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save changes'}
    </button>
  );
}
