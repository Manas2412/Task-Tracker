import * as argon2 from 'argon2';
import bcrypt from 'bcryptjs';

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

function isBcryptHash(hash: string): boolean {
  return hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$');
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  try {
    if (isBcryptHash(hash)) {
      return await bcrypt.compare(plain, hash);
    }
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export async function needsRehash(hash: string): Promise<boolean> {
  if (isBcryptHash(hash)) return true;
  try {
    return argon2.needsRehash(hash, { timeCost: 3, memoryCost: 65536 });
  } catch {
    return false;
  }
}
