import 'next-auth';
import 'next-auth/jwt';

/**
 * Module augmentation for NextAuth types.
 * Adds app-specific claims to `session.user` and the JWT payload.
 */

declare module 'next-auth' {
  interface User {
    id: string;
    username: string;
    hierarchySlot: string;
    isSuperAdmin: boolean;
    divisionId: string;
    forcePasswordChange: boolean;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      username: string;
      hierarchySlot: string;
      isSuperAdmin: boolean;
      divisionId: string;
      forcePasswordChange: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    username?: string;
    hierarchySlot?: string;
    isSuperAdmin?: boolean;
    divisionId?: string;
    forcePasswordChange?: boolean;
  }
}
