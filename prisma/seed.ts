/**
 * MYAS Task Tracker — Prisma seed
 *
 * Minimal seed: ONE division, ONE user. Everything else gets created
 * through the app's UI once Phase 1 CRUD is wired.
 *
 * Reads from .env:
 *   BOOTSTRAP_USERNAME      → the OSD's username
 *   BOOTSTRAP_PASSWORD      → their initial password
 *   BOOTSTRAP_NAME          → their display name
 *
 * Idempotent: clears all rows and re-inserts so re-running gives a fresh
 * known state. Safe to run every time the schema changes.
 */

import { PrismaClient } from '@prisma/client';

import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();

const BOOTSTRAP_USERNAME = process.env.BOOTSTRAP_USERNAME ?? 'osd.myas';
const BOOTSTRAP_PASSWORD = process.env.BOOTSTRAP_PASSWORD ?? 'ChangeMeImmediately!';
const BOOTSTRAP_NAME = process.env.BOOTSTRAP_NAME ?? 'OSD';

async function wipe() {
  console.log('Clearing tables…');
  // Children first.
  await prisma.$transaction([
    prisma.timelineFileActivity.deleteMany(),
    prisma.timelineFileTaskLink.deleteMany(),
    prisma.timelineFileMarkedTo.deleteMany(),
    prisma.taskActivity.deleteMany(),
    prisma.taskComment.deleteMany(),
    prisma.taskCollaborator.deleteMany(),
    prisma.taskTag.deleteMany(),
    prisma.reassignmentRequest.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.task.deleteMany(),
    prisma.timelineFile.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.user.deleteMany(),
    prisma.division.deleteMany(),
  ]);
}

async function main() {
  console.log(`Bootstrap user: ${BOOTSTRAP_USERNAME}\n`);

  await wipe();

  // Single division — the OSD's home. Real divisions get created via the
  // Super Admin Console once that lands.
  console.log('Creating bootstrap division…');
  const officeOfJs = await prisma.division.create({
    data: {
      name: 'Office of JS',
      kind: 'division',
      avatarColour: '#1e1b4b',
      hasPmu: false,
      displayOrder: 0,
    },
  });

  // Single user — the bootstrap super admin.
  console.log('Creating bootstrap user…');
  const passwordHash = await hashPassword(BOOTSTRAP_PASSWORD);
  await prisma.user.create({
    data: {
      name: BOOTSTRAP_NAME,
      username: BOOTSTRAP_USERNAME,
      passwordHash,
      designation: 'Officer on Special Duty',
      hierarchySlot: 'osd',
      divisionId: officeOfJs.id,
      isActive: true,
      isSuperAdmin: true,
    },
  });

  console.log('\nSeed complete.');
  console.log('Sign in at /login with the credentials from your .env.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
