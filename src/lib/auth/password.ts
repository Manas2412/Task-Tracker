import bcrypt from 'bcryptjs';

/**
 * Password hashing.
 *
 * Uses bcryptjs (pure JavaScript) — works on every runtime including
 * Vercel serverless. 12 salt rounds is the OWASP baseline for bcrypt.
 *
 * Hash a password before INSERT/UPDATE on `users.password_hash`.
 * Verify on every sign-in.
 */

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
