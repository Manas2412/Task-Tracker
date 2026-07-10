'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { loginAction } from './actions';
import { INITIAL_LOGIN_STATE, type LoginState } from '@/app/actions/states';

const initialState: LoginState = INITIAL_LOGIN_STATE;

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <section
      aria-labelledby="login-title"
      className="bg-panel border border-line rounded-2xl p-7 shadow-sm"
    >
      <header className="mb-6">
        <h1 id="login-title" className="font-serif text-[26px] leading-tight text-ink mb-1">
          Tasks
        </h1>
        <p className="text-[11px] tracking-[0.12em] uppercase text-ink-3 font-medium">
          Department of Sports
        </p>
      </header>

      <form action={formAction} className="space-y-4" noValidate>
        <Field
          id="username"
          name="username"
          label="Username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          error={state.fieldErrors?.username}
          mono
        />

        <Field
          id="password"
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          error={state.fieldErrors?.password}
        />

        {state.error ? (
          <p
            role="alert"
            className="text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2"
          >
            {state.error}
          </p>
        ) : null}

        <SubmitButton />

        <p className="text-[11px] text-ink-3 leading-relaxed pt-2">
          Forgotten your password? Ask your Super Admin to reset it. Email-based reset is not
          available.
        </p>
      </form>
    </section>
  );
}

type FieldProps = {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'password';
  autoComplete?: string;
  autoCapitalize?: 'none';
  autoFocus?: boolean;
  spellCheck?: boolean;
  error?: string;
  mono?: boolean;
};

function Field({ id, name, label, type, error, mono, ...rest }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-medium text-ink-2 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        className={[
          'w-full px-3 py-2.5 text-[14px] text-ink bg-panel',
          'border rounded-lg outline-none transition-colors',
          error
            ? 'border-urgent focus:border-urgent'
            : 'border-line focus:border-ink',
          mono ? 'font-mono' : '',
        ].join(' ')}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="text-[11px] text-urgent mt-1">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 rounded-lg bg-ink text-onink text-[14px] font-medium transition-opacity disabled:opacity-60"
    >
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}
