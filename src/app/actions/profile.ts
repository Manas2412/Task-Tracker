'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { auth, signOut } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/db';

/**
 * Profile-related server actions.
 *
 * changePassword:
 *   - Verifies current password against the stored argon2 hash
 *   - Enforces basic strength rules (length + cannot reuse current)
 *   - Writes new hash + sets password_changed_at + clears force_password_change
 *   - If the user was on a forced-change loop, sign them out so the next
 *     sign-in mints a fresh JWT without the force flag
 */

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(200),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .max(200, 'New password is too long'),
    confirmPassword: z.string().min(1, 'Confirm your new password').max(200),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'Choose a different password from the current one',
    path: ['newPassword'],
  });

type ChangePasswordState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<
    Record<'currentPassword' | 'newPassword' | 'confirmPassword', string>
  >;
  epoch?: number;
};

const INITIAL_CHANGE_PASSWORD_STATE: ChangePasswordState = {
  ok: false,
  epoch: 0,
};

export async function changePasswordAction(
  prev: ChangePasswordState | undefined,
  formData: FormData,
): Promise<ChangePasswordState> {
  const epoch = (prev?.epoch ?? 0) + 1;

  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: 'You are signed out. Refresh and try again.', epoch };
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    const fieldErrors: ChangePasswordState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (
        key === 'currentPassword' ||
        key === 'newPassword' ||
        key === 'confirmPassword'
      ) {
        fieldErrors[key] = issue.message;
      }
    }
    return { ok: false, fieldErrors, epoch };
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      passwordHash: true,
      forcePasswordChange: true,
    },
  });
  if (!me) return { ok: false, error: 'Your account could not be found.', epoch };

  const oldOk = await verifyPassword(parsed.data.currentPassword, me.passwordHash);
  if (!oldOk) {
    return {
      ok: false,
      fieldErrors: { currentPassword: 'Current password is incorrect' },
      epoch,
    };
  }

  try {
    const newHash = await hashPassword(parsed.data.newPassword);
    await prisma.user.update({
      where: { id: me.id },
      data: {
        passwordHash: newHash,
        passwordChangedAt: new Date(),
        forcePasswordChange: false,
      },
    });
  } catch (err) {
    console.error('changePasswordAction failed:', err);
    return { ok: false, error: 'Could not save the new password. Try again.', epoch };
  }

  // If the user was in a forced-change loop, the JWT still carries
  // forcePasswordChange = true. Mint a fresh session by signing them out.
  if (me.forcePasswordChange) {
    await signOut({ redirectTo: '/login?passwordChanged=1' });
    // signOut throws NEXT_REDIRECT — unreachable.
    return { ok: true, epoch };
  }

  revalidatePath('/profile');
  return { ok: true, epoch };
}

/**
 * Convenience server action: redirect to /profile (used after success when
 * the form is rendered from inside the AppShell).
 */
export async function returnToProfileAction() {
  redirect('/profile');
}
