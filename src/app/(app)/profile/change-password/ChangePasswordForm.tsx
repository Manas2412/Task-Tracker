'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';

import { changePasswordAction } from '@/app/actions/profile';
import {
  INITIAL_CHANGE_PASSWORD_STATE,
  type ChangePasswordState,
} from '@/app/actions/states';
import { cn } from '@/lib/utils';

type ChangePasswordFormProps = {
  wasForced: boolean;
};

export function ChangePasswordForm({ wasForced }: ChangePasswordFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [state, formAction] = useFormState<ChangePasswordState, FormData>(
    changePasswordAction,
    INITIAL_CHANGE_PASSWORD_STATE,
  );

  // Voluntary change: success → reset + show flash on /profile/change-password?changed=1
  // Forced change: server triggers signOut + redirects to /login itself, this block won't run.
  useEffect(() => {
    if (state.ok && !wasForced) {
      formRef.current?.reset();
      router.replace('/profile/change-password?changed=1');
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4" noValidate>
      <Field
        id="currentPassword"
        name="currentPassword"
        label="Current password"
        autoComplete="current-password"
        autoFocus
        error={state.fieldErrors?.currentPassword}
      />

      <Field
        id="newPassword"
        name="newPassword"
        label="New password"
        autoComplete="new-password"
        error={state.fieldErrors?.newPassword}
        hint="At least 8 characters"
      />

      <Field
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        error={state.fieldErrors?.confirmPassword}
      />

      {state.error ? (
        <p
          role="alert"
          className="text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2"
        >
          {state.error}
        </p>
      ) : null}

      <SaveButton wasForced={wasForced} />
    </form>
  );
}

function Field({
  id,
  name,
  label,
  autoComplete,
  autoFocus,
  error,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete?: string;
  autoFocus?: boolean;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-medium text-ink-2 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="password"
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className={cn(
          'w-full px-3 py-2.5 rounded-lg border bg-panel text-[14px] text-ink outline-none transition-colors',
          error ? 'border-urgent focus:border-urgent' : 'border-line focus:border-ink',
        )}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
      {error ? (
        <p id={`${id}-error`} className="text-[11px] text-urgent mt-1">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[11px] text-ink-3 mt-1">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function SaveButton({ wasForced }: { wasForced: boolean }) {
  const { pending } = useFormStatus();
  const label = wasForced ? 'Update and sign in again' : 'Update password';
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 py-3 rounded-lg bg-ink text-white text-[14px] font-medium transition-opacity disabled:opacity-60"
    >
      {pending ? 'Saving…' : label}
    </button>
  );
}
