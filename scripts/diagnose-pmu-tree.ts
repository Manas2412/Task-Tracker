/**
 * Read-only diagnostic: for every PMU team, print members and where their
 * supervisor sits (inside the team, its home division, or elsewhere).
 * Run: npx tsx scripts/diagnose-pmu-tree.ts   (needs DATABASE_URL)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const pmus = await prisma.division.findMany({
    where: { kind: 'pmu' },
    select: { id: true, name: true, parentId: true, pmuParentDivisionId: true },
  });
  console.log(`${pmus.length} PMU team(s)`);

  for (const pmu of pmus) {
    const members = await prisma.user.findMany({
      where: { pmuId: pmu.id },
      select: {
        username: true,
        isActive: true,
        supervisorId: true,
        supervisor: { select: { username: true, pmuId: true } },
      },
      orderBy: { name: 'asc' },
    });
    const memberIds = new Set(
      (await prisma.user.findMany({ where: { pmuId: pmu.id }, select: { id: true } })).map(
        (m) => m.id,
      ),
    );
    console.log(`\n== ${pmu.name} — ${members.length} member(s)`);
    for (const m of members) {
      const supLoc = !m.supervisorId
        ? 'NO SUPERVISOR'
        : memberIds.has(m.supervisorId)
          ? 'in team'
          : m.supervisor?.pmuId
            ? `in other PMU (${m.supervisor.username})`
            : `outside team (${m.supervisor?.username})`;
      console.log(
        `  ${m.username.padEnd(12)} active=${m.isActive} supervisor=${supLoc}`,
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
