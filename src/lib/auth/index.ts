import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { authConfig } from '@/lib/auth/config';
import { hashPassword, needsRehash, verifyPassword } from '@/lib/auth/password';
import { rateLimit } from '@/lib/rate-limit';

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(60),
  password: z.string().min(1).max(200),
});

/**
 * Full NextAuth setup — Node runtime only.
 *
 * Exports:
 *   - handlers   → mounted at /api/auth/[...nextauth]
 *   - auth       → server-side session reader (`const session = await auth()`)
 *   - signIn     → server-side programmatic sign-in (used inside server actions)
 *   - signOut    → server-side programmatic sign-out
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { username, password } = parsed.data;

        const { ok: allowed } = rateLimit(`login:${username}`, 5, 60_000);
        if (!allowed) return null;

        const user = await prisma.user.findUnique({
          where: { username },
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            passwordHash: true,
            hierarchySlot: true,
            isSuperAdmin: true,
            divisionId: true,
            isActive: true,
            forcePasswordChange: true,
          },
        });

        if (!user) return null;
        if (!user.isActive) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        // Re-hash legacy bcrypt passwords to argon2id on successful login.
        if (await needsRehash(user.passwordHash)) {
          hashPassword(password).then((newHash) =>
            prisma.user
              .update({ where: { id: user.id }, data: { passwordHash: newHash } })
              .catch(() => {/* swallow */}),
          );
        }

        prisma.user
          .update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
          })
          .catch(() => {
            /* swallow */
          });
        prisma.auditLog
          .create({
            data: {
              actorId: user.id,
              action: 'login',
              entityType: 'user',
              entityId: user.id,
              before: {},
              after: { username: user.username },
            },
          })
          .catch(() => {
            /* swallow */
          });

        return {
          id: user.id,
          name: user.name,
          email: user.email ?? undefined,
          username: user.username,
          hierarchySlot: user.hierarchySlot,
          isSuperAdmin: user.isSuperAdmin,
          divisionId: user.divisionId,
          forcePasswordChange: user.forcePasswordChange,
        };
      },
    }),
  ],
});
