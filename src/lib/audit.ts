import { prisma } from '@/lib/db';

/**
 * Audit-trail helpers.
 *
 * The audit_log table is insert-only (PRD §5.8) — these helpers only read
 * + decorate, never mutate. Writes happen inside each Super Admin action
 * (admin-users.ts, admin-structure.ts, etc.) and in the auth `authorize`
 * callback for login events.
 */

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'archive'
  | 'restore'
  | 'login'
  | 'logout'
  | 'password_reset'
  | 'role_change'
  | 'hierarchy_change';

export type AuditEntity = 'user' | 'division' | 'task' | 'timeline_file' | 'attachment' | 'tag' | 'system';

export type AuditEntry = {
  id: string;
  createdAt: Date;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  actor: {
    id: string | null;
    name: string;
    division: { avatarColour: string } | null;
  };
  /** Resolved display name for the entity (falls back to id) */
  entityName: string;
};

const PAGE_SIZE = 50;

/**
 * Fetch a page of audit entries, scoped by optional filters, and decorate
 * each row with the actor's name + a best-effort entity display name.
 */
export async function fetchAuditEntries(opts: {
  entity?: AuditEntity | 'all';
  action?: AuditAction | 'all';
  page: number;
}): Promise<{ entries: AuditEntry[]; total: number; pageSize: number }> {
  const where: Record<string, unknown> = {};
  if (opts.entity && opts.entity !== 'all') where.entityType = opts.entity;
  if (opts.action && opts.action !== 'all') where.action = opts.action;

  const pageSize = PAGE_SIZE;
  const skip = Math.max(0, (opts.page - 1) * pageSize);

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        actor: {
          include: { division: { select: { avatarColour: true } } },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Group entity IDs by type for batch lookup.
  const byType = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!byType.has(r.entityType)) byType.set(r.entityType, new Set());
    byType.get(r.entityType)!.add(r.entityId);
  }

  // Resolve display names per entity type.
  const nameLookup = new Map<string, string>(); // key = `${type}:${id}`

  const userIds = Array.from(byType.get('user') ?? []);
  const divIds = Array.from(byType.get('division') ?? []);
  const taskIds = Array.from(byType.get('task') ?? []);
  const tfIds = Array.from(byType.get('timeline_file') ?? []);

  const [users, divs, tasks, tfs] = await Promise.all([
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, username: true },
        })
      : Promise.resolve([]),
    divIds.length
      ? prisma.division.findMany({
          where: { id: { in: divIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    taskIds.length
      ? prisma.task.findMany({
          where: { id: { in: taskIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    tfIds.length
      ? prisma.timelineFile.findMany({
          where: { id: { in: tfIds } },
          select: { id: true, refNo: true, subject: true },
        })
      : Promise.resolve([]),
  ]);

  for (const u of users) nameLookup.set(`user:${u.id}`, `${u.name} (${u.username})`);
  for (const d of divs) nameLookup.set(`division:${d.id}`, d.name);
  for (const t of tasks) nameLookup.set(`task:${t.id}`, t.name);
  for (const tf of tfs)
    nameLookup.set(`timeline_file:${tf.id}`, `${tf.refNo} · ${tf.subject}`);

  const entries: AuditEntry[] = rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    action: r.action as AuditAction,
    entityType: r.entityType,
    entityId: r.entityId,
    before: (r.before as Record<string, unknown>) ?? {},
    after: (r.after as Record<string, unknown>) ?? {},
    actor: {
      id: r.actor?.id ?? null,
      name: r.actor?.name ?? 'System',
      division: r.actor?.division ? { avatarColour: r.actor.division.avatarColour } : null,
    },
    entityName: nameLookup.get(`${r.entityType}:${r.entityId}`) ?? r.entityId,
  }));

  return { entries, total, pageSize };
}

/**
 * Summarise a before/after diff into a compact, sentence-ish string.
 * Returns up to N key changes; falls back to "Created" / "Removed" when
 * one side is empty.
 */
export function summariseDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string {
  const bKeys = Object.keys(before);
  const aKeys = Object.keys(after);

  if (bKeys.length === 0 && aKeys.length > 0) {
    // Creation event — show the most useful fields
    return summariseObject(after);
  }
  if (bKeys.length > 0 && aKeys.length === 0) {
    return summariseObject(before);
  }

  const keys = new Set([...bKeys, ...aKeys]);
  const changes: string[] = [];
  for (const key of keys) {
    const bVal = JSON.stringify(before[key] ?? null);
    const aVal = JSON.stringify(after[key] ?? null);
    if (bVal !== aVal) {
      changes.push(`${key}: ${formatVal(before[key])} → ${formatVal(after[key])}`);
    }
    if (changes.length >= 4) break;
  }
  return changes.length > 0 ? changes.join(' · ') : 'No visible changes';
}

function summariseObject(obj: Record<string, unknown>): string {
  const preferKeys = ['name', 'username', 'subject', 'refNo', 'kind', 'isSuperAdmin'];
  const parts: string[] = [];
  for (const k of preferKeys) {
    if (k in obj) parts.push(`${k}: ${formatVal(obj[k])}`);
  }
  if (parts.length === 0) {
    // Fall back to first three keys
    const keys = Object.keys(obj).slice(0, 3);
    for (const k of keys) parts.push(`${k}: ${formatVal(obj[k])}`);
  }
  return parts.join(' · ');
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return '∅';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return v.length > 36 ? `${v.slice(0, 33)}…` : v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return `[${v.length}]`;
  return '{…}';
}
