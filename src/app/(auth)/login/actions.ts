'use server';

import { AuthError } from 'next-auth';
import { z } from 'zod';

import { signIn } from '@/lib/auth';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username').max(60),
  password: z.string().min(1, 'Enter your password').max(200),
});

type LoginState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<Record<'username' | 'password', string>>;
};

/**
 * Server action: sign in with username + password.
 *
 * On success, NextAuth's `signIn` throws a NEXT_REDIRECT (which Next.js
 * handles transparently) and the user lands on /tasks. We re-throw that
 * redirect so it doesn't get swallowed as an unexpected error.
 *
 * On wrong credentials, NextAuth throws CredentialsSignin. We map it to a
 * sentence-case message per the copy rules.
 */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const fieldErrors: LoginState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === 'username' || key === 'password') {
        fieldErrors[key] = issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  try {
    await signIn('credentials', {
      username: parsed.data.username,
      password: parsed.data.password,
      redirectTo: '/tasks',
    });
    // Unreachable — signIn throws to redirect.
    return { ok: true };
  } catch (error) {
    // Let Next.js handle its own redirect signal.
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error;
    }
    if (error instanceof AuthError) {
      if (error.type === 'CredentialsSignin') {
        return { ok: false, error: 'Username or password is incorrect' };
      }
      return { ok: false, error: 'Could not sign you in. Try again.' };
    }
    throw error;
  }
}
