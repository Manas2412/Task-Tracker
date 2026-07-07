import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';

/**
 * GET /api/cron/due-notifications
 *
 * Creates "task_due_soon" and "task_overdue" notifications.
 * Designed to be hit by an external cron (e.g. every hour).
 *
 * Protected by CRON_SECRET env var — pass it as the
 * `Authorization: Bearer <value>` header.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 503 },
    );
  }

  const hSecret = request.headers.get('authorization')?.replace('Bearer ', '') ?? '';
  const a = Buffer.from(hSecret);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const dueSoon = await prisma.task.findMany({
    where: {
      dueDate: { gt: now, lte: in24h },
      status: { notIn: ['completed'] },
      archivedAt: null,
    },
    select: { id: true, name: true, ownerId: true },
  });

  const overdue = await prisma.task.findMany({
    where: {
      dueDate: { lt: now },
      status: { notIn: ['completed'] },
      archivedAt: null,
    },
    select: { id: true, name: true, ownerId: true },
  });

  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentNotifs = await prisma.notification.findMany({
    where: {
      type: { in: ['task_due_soon', 'task_overdue'] },
      createdAt: { gte: oneDayAgo },
    },
    select: { userId: true, type: true, payload: true },
  });

  const seen = new Set(
    recentNotifs.map((n) => `${n.type}:${(n.payload as Record<string, string>).taskId}:${n.userId}`),
  );

  const notifs: Prisma.NotificationCreateManyInput[] = [];

  for (const t of dueSoon) {
    const key = `task_due_soon:${t.id}:${t.ownerId}`;
    if (!seen.has(key)) {
      notifs.push({
        userId: t.ownerId,
        type: 'task_due_soon',
        payload: { taskId: t.id, taskName: t.name },
      });
    }
  }

  for (const t of overdue) {
    const key = `task_overdue:${t.id}:${t.ownerId}`;
    if (!seen.has(key)) {
      notifs.push({
        userId: t.ownerId,
        type: 'task_overdue',
        payload: { taskId: t.id, taskName: t.name },
      });
    }
  }

  if (notifs.length > 0) {
    await prisma.notification.createMany({ data: notifs });
  }

  return NextResponse.json({
    created: notifs.length,
    dueSoon: dueSoon.length,
    overdue: overdue.length,
  });
}
