import argon2 from 'argon2';

/**
 * Password hashing.
 *
 * Argon2id with OWASP-recommended parameters as of 2025.
 * `memoryCost` is in KiB — 19 456 KiB ≈ 19 MiB.
 *
 * Hash a password before INSERT/UPDATE on `users.password_hash`.
 * Verify on every sign-in.
 *
 * Never call this from edge runtime — argon2 is a native module.
 * Server actions and route handlers run on the Node runtime by default.
 */

const HASH_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, HASH_OPTIONS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
