'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Sheet } from '@/components/ui';
import { createUserAction } from '@/app/actions/admin-users';
import {
  INITIAL_ADMIN_USER_STATE,
  type AdminUserState,
} from '@/app/actions/states';
import { cn } from '@/lib/utils';

import {
  UserFormFields,
  type UserFormDivisionOption,
  type UserFormSupervisorOption,
} from './UserFormFields';

type CreateUserDialogProps = {
  divisions: UserFormDivisionOption[];
  supervisors: UserFormSupervisorOption[];
};

export function CreateUserDialog({ divisions, supervisors }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState<AdminUserState, FormData>(
    createUserAction,
    INITIAL_ADMIN_USER_STATE,
  );

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink text-white text-[13px] font-medium',
          'hover:bg-ink-2 transition-colors',
        )}
      >
        <i className="ti ti-user-plus text-[14px]" aria-hidden="true" />
        Add user
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Add user"
        subtitle="Initial password is shared offline. The user can change it from their profile."
      >
        {open ? (
          <form ref={formRef} action={formAction} className="flex flex-col gap-4">
            <UserFormFields
              mode="create"
              divisions={divisions}
              supervisors={supervisors}
              fieldErrors={state.fieldErrors}
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
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 rounded-lg border border-line text-[13px] font-medium text-ink-2 hover:bg-line-2"
              >
                Cancel
              </button>
              <SaveButton />
            </div>
          </form>
        ) : null}
      </Sheet>
    </>
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
      {pending ? 'Creating…' : 'Create user'}
    </button>
  );
}
