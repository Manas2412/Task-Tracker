/**
 * Import tasks from the server export into the freshly seeded Neon DB.
 *
 * Remaps old dummy divisions / owners to the real seeded users.
 * Creates parent tasks first, then subtasks.
 *
 * Usage: npx tsx scripts/import-tasks.ts
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

const DIVISION_MAP: Record<string, string> = {
  'Khelo India Division': 'Khelo India',
  'KIM': 'Khelo India',
  'KIM PMU': 'Khelo India',
  'NSDF': 'NSDF',
  'SGM': 'SGM',
  'Media & IT': 'Media & IT',
  'Autonomous Bodies': 'Autonomous Bodies',
  'Office of JS': 'Office of JS',
  'HMAYS': 'Office of JS',
};

const OWNER_MAP: Record<string, string> = {
  'Khelo India Division': 'zuber',
  'KIM': 'zuber',
  'KIM PMU': 'zuber',
  'NSDF': 'zuber',
  'SGM': 'harilal',
  'Media & IT': 'ayushman',
  'Autonomous Bodies': 'zuber',
  'Office of JS': 'osd.myas',
  'HMAYS': 'osd.myas',
};

interface ExportedTask {
  name: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  visibility: string;
  recurrence_rule: string | null;
  milestone: boolean;
  js_priority_lane: string | null;
  created_at: string;
  owner_name: string;
  owner_username: string;
  creator_name: string;
  creator_username: string;
  division_name: string;
  parent_task_name: string | null;
}

async function main() {
  const raw = readFileSync(join(__dirname, 'tasks-export.json'), 'utf-8');
  const tasks: ExportedTask[] = JSON.parse(raw);

  console.log(`Loaded ${tasks.length} tasks from export`);

  // Look up all divisions
  const divisions = await prisma.division.findMany();
  const divisionByName = new Map(divisions.map((d) => [d.name, d]));

  // Look up all users
  const users = await prisma.user.findMany();
  const userByUsername = new Map(users.map((u) => [u.username, u]));

  // Resolve the OSD user (creator for all tasks)
  const osd = userByUsername.get('osd.myas');
  if (!osd) throw new Error('OSD user not found');

  // Split into parent tasks and subtasks
  const parentTasks = tasks.filter((t) => !t.parent_task_name);
  const subtasks = tasks.filter((t) => !!t.parent_task_name);

  console.log(`  ${parentTasks.length} parent tasks, ${subtasks.length} subtasks`);

  // Track created tasks by name for subtask linking
  const createdTasksByName = new Map<string, string>();

  let created = 0;
  let skipped = 0;

  // Create parent tasks first
  for (const t of parentTasks) {
    const newDivName = DIVISION_MAP[t.division_name];
    if (!newDivName) {
      console.warn(`  SKIP: unknown division "${t.division_name}" for task "${t.name}"`);
      skipped++;
      continue;
    }

    const division = divisionByName.get(newDivName);
    if (!division) {
      console.warn(`  SKIP: division "${newDivName}" not found in DB for task "${t.name}"`);
      skipped++;
      continue;
    }

    // If original owner is osd.myas, keep as OSD; otherwise use the division mapping
    let ownerUsername: string;
    if (t.owner_username === 'osd.myas') {
      ownerUsername = 'osd.myas';
    } else {
      ownerUsername = OWNER_MAP[t.division_name] ?? 'osd.myas';
    }

    const owner = userByUsername.get(ownerUsername);
    if (!owner) {
      console.warn(`  SKIP: owner "${ownerUsername}" not found for task "${t.name}"`);
      skipped++;
      continue;
    }

    const task = await prisma.task.create({
      data: {
        name: t.name,
        description: t.description,
        status: t.status as any,
        priority: t.priority as any,
        visibility: t.visibility as any,
        dueDate: t.due_date ? new Date(t.due_date) : null,
        milestone: t.milestone,
        recurrenceRule: t.recurrence_rule as any,
        jsPriorityLane: t.js_priority_lane as any,
        ownerId: owner.id,
        divisionId: division.id,
        createdById: osd.id,
        createdAt: new Date(t.created_at),
      },
    });

    createdTasksByName.set(t.name, task.id);
    created++;
  }

  console.log(`  Created ${created} parent tasks (${skipped} skipped)`);

  // Create subtasks
  let subCreated = 0;
  let subSkipped = 0;

  for (const t of subtasks) {
    const parentId = createdTasksByName.get(t.parent_task_name!);
    if (!parentId) {
      console.warn(`  SKIP subtask: parent "${t.parent_task_name}" not found for "${t.name}"`);
      subSkipped++;
      continue;
    }

    const newDivName = DIVISION_MAP[t.division_name];
    if (!newDivName) {
      console.warn(`  SKIP subtask: unknown division "${t.division_name}" for "${t.name}"`);
      subSkipped++;
      continue;
    }

    const division = divisionByName.get(newDivName);
    if (!division) {
      subSkipped++;
      continue;
    }

    let ownerUsername: string;
    if (t.owner_username === 'osd.myas') {
      ownerUsername = 'osd.myas';
    } else {
      ownerUsername = OWNER_MAP[t.division_name] ?? 'osd.myas';
    }

    const owner = userByUsername.get(ownerUsername);
    if (!owner) {
      subSkipped++;
      continue;
    }

    const task = await prisma.task.create({
      data: {
        name: t.name,
        description: t.description,
        status: t.status as any,
        priority: t.priority as any,
        visibility: t.visibility as any,
        dueDate: t.due_date ? new Date(t.due_date) : null,
        milestone: t.milestone,
        recurrenceRule: t.recurrence_rule as any,
        jsPriorityLane: t.js_priority_lane as any,
        ownerId: owner.id,
        divisionId: division.id,
        createdById: osd.id,
        parentTaskId: parentId,
        createdAt: new Date(t.created_at),
      },
    });

    createdTasksByName.set(t.name, task.id);
    subCreated++;
  }

  console.log(`  Created ${subCreated} subtasks (${subSkipped} skipped)`);
  console.log(`\nTotal: ${created + subCreated} tasks imported`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
