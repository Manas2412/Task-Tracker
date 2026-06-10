import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton.
 *
 * In dev, Next.js hot-reloads modules, which would otherwise create a new
 * PrismaClient on every reload and exhaust the connection pool. Cache it on
 * globalThis so the same instance is reused across reloads.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
