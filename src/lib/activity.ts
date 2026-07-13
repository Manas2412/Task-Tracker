import { prisma } from '@/lib/db';

/**
 * "Recently modified" bookkeeping.
 *
 * Both Task and TimelineFile carry a `last_activity_at` column that drives the
 * "Recently modified" list sort. These helpers stamp it to `now()` for a single
 * MEANINGFUL modification — a comment, an attachment, a subtask/tag/collaborator
 * change, an owner/status/priority/context edit, a marked-to change, a linked
 * task, and so on.
 *
 * Two deliberate rules:
 *
 *   1. Never call these for a passive read (the `task_read` / `subtask_read`
 *      activity events). Opening or viewing an item must not move it up the
 *      list — that is the whole point of a "meaningful updates only" sort.
 *
 *   2. Raw UPDATE on purpose. A Prisma `.update()` would also fire Task's
 *      `@updatedAt`, i.e. the "Last edited" timestamp shown on the task detail
 *      page. `last_activity_at` is broader than an edit (it also advances on
 *      comments and attachments that never touch the task row), so bumping it
 *      must not silently rewrite "Last edited". Actions that genuinely edit the
 *      row (status, priority, owner, fields) instead set `lastActivityAt`
 *      inline on their existing `.update()` — where advancing `updatedAt` is
 *      correct anyway.
 *
 * Both return a `PrismaPromise`, so they compose inside an interactive
 * transaction (`await touchTaskActivity(tx, id)`) and inside an array
 * transaction (`prisma.$transaction([..., touchTaskActivity(prisma, id)])`).
 */

/** Minimal client surface shared by the base client and a transaction client. */
type RawExecutor = Pick<typeof prisma, '$executeRaw'>;

/** Stamp a task's `last_activity_at` to now(). */
export function touchTaskActivity(client: RawExecutor, taskId: string) {
  return client.$executeRaw`UPDATE "tasks" SET "last_activity_at" = now() WHERE "id" = ${taskId}::uuid`;
}

/** Stamp a timeline file's `last_activity_at` to now(). */
export function touchTimelineFileActivity(client: RawExecutor, timelineFileId: string) {
  return client.$executeRaw`UPDATE "timeline_files" SET "last_activity_at" = now() WHERE "id" = ${timelineFileId}::uuid`;
}

/** Stamp a document record's `last_activity_at` to now(). */
export function touchDocumentActivity(client: RawExecutor, documentRecordId: string) {
  return client.$executeRaw`UPDATE "document_records" SET "last_activity_at" = now() WHERE "id" = ${documentRecordId}::uuid`;
}
