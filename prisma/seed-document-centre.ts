/**
 * Idempotent provisioning for the Document Centre org data:
 *   - the HMAYS division
 *   - the osd.ss and osd.dgsai desk accounts (HMAYS members)
 *
 * Safe to run against any environment, repeatedly — it upserts and never wipes
 * (unlike the main destructive `seed.ts`). Run once after applying the
 * Document Centre migrations:
 *
 *   SEED_DEFAULT_PASSWORD='<temp password>' pnpm db:seed:document-centre
 *
 * Both accounts are created with forcePasswordChange=true, so the temp
 * password must be changed on first login. They are deliberately NOT Super
 * Admins and NOT the 'osd' hierarchy slot: as ordinary HMAYS-division heads
 * the existing visibility rules isolate them to HMAYS data across Tasks,
 * Timeline Files, Calendar, Priority Board, and Search — exactly the required
 * "HMAYS users only see HMAYS data" behaviour, with no change to the
 * visibility engine. Their Document Centre access comes from the username
 * allowlist (src/lib/document-centre-shared.ts), independent of division.
 */
import { PrismaClient } from '@prisma/client';

import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();

const DEFAULT_TEMP_PASSWORD = 'MyasDoc@2026';

const DESK_ACCOUNTS = [
  {
    username: 'osd.ss',
    name: 'OSD (SS)',
    designation: 'Officer on Special Duty — Secretary, Sports',
  },
  {
    username: 'osd.dgsai',
    name: 'OSD (DG SAI)',
    designation: 'Officer on Special Duty — Director General, SAI',
  },
];

async function main() {
  const tempPassword = process.env.SEED_DEFAULT_PASSWORD || DEFAULT_TEMP_PASSWORD;
  if (!process.env.SEED_DEFAULT_PASSWORD) {
    console.warn(
      `SEED_DEFAULT_PASSWORD not set — using the built-in default "${DEFAULT_TEMP_PASSWORD}". ` +
        'Both accounts require a password change on first login.',
    );
  }

  // 1) HMAYS division (idempotent by name). Do not clobber an existing row
  //    (e.g. one created by seed-pdf-tasks.ts).
  let hmays = await prisma.division.findFirst({ where: { name: 'HMAYS' } });
  if (!hmays) {
    const maxOrder = await prisma.division.aggregate({ _max: { displayOrder: true } });
    hmays = await prisma.division.create({
      data: {
        name: 'HMAYS',
        kind: 'division',
        avatarColour: '#854d0e',
        abbreviation: 'HMAYS',
        displayOrder: (maxOrder._max.displayOrder ?? 0) + 1,
      },
    });
    console.log(`Created HMAYS division (${hmays.id}).`);
  } else {
    console.log(`HMAYS division already exists (${hmays.id}).`);
  }

  // 2) The two desk accounts (idempotent by username). Passwords are only set
  //    on first creation — an upsert update must never silently reset one.
  const passwordHash = await hashPassword(tempPassword);
  const createdUserIds: string[] = [];
  for (const acct of DESK_ACCOUNTS) {
    const existing = await prisma.user.findUnique({ where: { username: acct.username } });
    if (existing) {
      await prisma.user.update({
        where: { username: acct.username },
        data: { divisionId: hmays.id, isActive: true },
      });
      console.log(`Ensured ${acct.username} is an active HMAYS member.`);
      createdUserIds.push(existing.id);
    } else {
      const user = await prisma.user.create({
        data: {
          name: acct.name,
          username: acct.username,
          passwordHash,
          designation: acct.designation,
          hierarchySlot: 'director',
          divisionId: hmays.id,
          isActive: true,
          isSuperAdmin: false,
          forcePasswordChange: true,
        },
      });
      console.log(`Created ${acct.username} (${user.id}).`);
      createdUserIds.push(user.id);
    }
  }

  // 3) Make osd.ss the HMAYS head if the division has none yet (so the desk can
  //    manage HMAYS tasks/records). Never overrides an existing head.
  if (!hmays.headUserId && createdUserIds[0]) {
    await prisma.division.update({
      where: { id: hmays.id },
      data: { headUserId: createdUserIds[0] },
    });
    console.log('Set osd.ss as the HMAYS division head.');
  }

  console.log('Document Centre org provisioning complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
