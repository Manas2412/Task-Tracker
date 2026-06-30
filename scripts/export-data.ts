/**
 * Export tasks and timeline files to JSON before re-seeding.
 *
 * Captures owner/creator by NAME (not ID) so they can be matched
 * to freshly seeded users. Parent-child subtask relationships are
 * preserved via task name chains.
 *
 * Usage: npx tsx scripts/export-data.ts
 * Output: scripts/export.json
 */

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  // ── Tasks ─────────────────────────────────────────────
  const tasks = await prisma.task.findMany({
    include: {
      owner: { select: { name: true, username: true } },
      createdBy: { select: { name: true, username: true } },
      division: { select: { name: true } },
      parentTask: { select: { name: true } },
      linkedTimelineFile: { select: { refNo: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const exportedTasks = tasks.map((t) => ({
    name: t.name,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate?.toISOString() ?? null,
    visibility: t.visibility,
    recurrenceRule: t.recurrenceRule,
    milestone: t.milestone,
    jsPriorityLane: t.jsPriorityLane,
    ownerName: t.owner.name,
    ownerUsername: t.owner.username,
    creatorName: t.createdBy?.name ?? t.owner.name,
    creatorUsername: t.createdBy?.username ?? t.owner.username,
    divisionName: t.division.name,
    parentTaskName: t.parentTask?.name ?? null,
    linkedTfRefNo: t.linkedTimelineFile?.refNo ?? null,
    isArchived: !!t.archivedAt,
    createdAt: t.createdAt.toISOString(),
  }));

  // ── Timeline Files ────────────────────────────────────
  const tfs = await prisma.timelineFile.findMany({
    include: {
      createdBy: { select: { name: true, username: true } },
      markedTo: { include: { division: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const exportedTfs = tfs.map((tf) => ({
    refNo: tf.refNo,
    refYear: tf.refYear,
    refSeq: tf.refSeq,
    subject: tf.subject,
    fromWhom: tf.fromWhom,
    receivedDate: tf.receivedDate.toISOString(),
    status: tf.status,
    deadlineDate: tf.deadlineDate?.toISOString() ?? null,
    secretaryComments: tf.secretaryComments,
    creatorName: tf.createdBy?.name ?? null,
    creatorUsername: tf.createdBy?.username ?? null,
    markedToDivisions: tf.markedTo.map((m) => m.division.name),
    isArchived: !!tf.archivedAt,
    createdAt: tf.createdAt.toISOString(),
  }));

  const data = {
    exportedAt: new Date().toISOString(),
    tasks: exportedTasks,
    timelineFiles: exportedTfs,
  };

  const outPath = join(__dirname, 'export.json');
  writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');

  console.log(`Exported ${exportedTasks.length} tasks, ${exportedTfs.length} timeline files`);
  console.log(`Written to ${outPath}`);

  // Summary
  const parentTasks = exportedTasks.filter((t) => !t.parentTaskName);
  const subtasks = exportedTasks.filter((t) => !!t.parentTaskName);
  console.log(`  ${parentTasks.length} top-level tasks, ${subtasks.length} subtasks`);
  console.log(`  ${exportedTfs.length} timeline files`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
