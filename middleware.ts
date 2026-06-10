import NextAuth from 'next-auth';

import { authConfig } from '@/lib/auth/config';

/**
 * Edge middleware — gates every request that isn't a public asset or an
 * auth API endpoint. Logic lives in authConfig.callbacks.authorized.
 *
 * Critical: this file must stay edge-safe. Do NOT import argon2, prisma,
 * or anything that pulls in native modules.
 */
export const { auth: middleware } = NextAuth(authConfig);

export default middleware((req) => {
  // The `authorized` callback already decides whether to allow or redirect.
  // Returning nothing here lets that decision stand.
  void req;
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
