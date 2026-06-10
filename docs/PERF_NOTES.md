# Performance characteristics — Phase 4 audit

Reference snapshot of where the app stands at the end of Phase 4. Use this when bug-hunting a slow page or deciding whether a query needs work.

## Database indexes — what's covered

The Prisma schema declares the following indexes on hot paths. Postgres picks them via the standard B-tree planner; no manual hints are needed.

### `tasks`
| Index | Used by |
|---|---|
| `ownerId` | "My tasks", reassignment lookups |
| `divisionId` | Division-scoped listing, OSD Command Centre |
| `status` | Status filters on `/tasks` and the JS Priority Board |
| `jsPriorityLane` | JS Priority Board ordering + lane filters |
| `dueDate` | Today / overdue / calendar queries |
| `parentTaskId` | Subtask resolution |
| `linkedTimelineFileId` | TF detail page "Linked tasks" panel |

### `task_comments`, `task_activity`
Both carry composite `(taskId, createdAt DESC)` indexes — the detail page renders both in reverse chronological order without a sort step.

### `timeline_files`
| Index | Used by |
|---|---|
| `deadlineDate` | Deadline countdown sort on `/timeline-files` |
| `status` | Status filter |
| `receivedDate DESC` | Default reverse-chronological listing |
| `(refYear, refSeq)` unique | Ref-number generation collision check |

### `notifications`
Composite `(userId, createdAt DESC)` — the bell dropdown and `/notifications` both read by `userId` ordered newest-first. Single index, both paths covered.

### `audit_log`
Three indexes:
- `(entityType, entityId, createdAt DESC)` — entity-specific audit trails
- `(actorId, createdAt DESC)` — "actions by user X" filter
- `createdAt DESC` — global recent activity

### `attachments`
Composite `(ownerType, ownerId)` — Task detail and TF detail both query by these two together.

## Render strategy

- Every authenticated page is a **dynamic server component**. We don't `force-static` or `revalidate` anything that depends on `auth()`.
- Mutations call `revalidatePath('/tasks')` / `revalidatePath('/timeline-files/[id]')` / etc. on the affected routes. Path-based revalidation is per-route — adjacent routes stay cached.
- `loading.tsx` skeletons live on the four heaviest pages: `/tasks`, `/timeline-files`, `/admin/audit`, `/search`. They mirror the real layout so the first paint is structural, not blank.

## Query budgets — what each page roughly costs

| Page | Queries | Notes |
|---|---|---|
| `/tasks` | 2 — `fetchVisibleTasks` + `fetchTaskCounts`. Both run in `Promise.all`. | Visibility clauses cap result set; cards include subtasks + collaborators in one query (no N+1) |
| `/tasks/[id]` | ~4–5 — task with all relations, candidate users, mentionables (cap 200), tags, attachments | Heaviest single page; all in `Promise.all` where independent |
| `/timeline-files` | 2 — list + counts | |
| `/timeline-files/[id]` | ~6 — TF with relations, attachments, linked tasks | |
| `/notifications` | 3 — list + total count + unread count, parallel | |
| `/admin/audit` | 2 — page slice + total count | Cursor pagination via `take/skip` |
| `/calendar` | 1 — `fetchEventsInRange` | Single date-bounded query |

## What's deliberately NOT in this pass

- **No Redis / external cache** — not required at the 50–200 daily-user scale. Postgres + Next's per-route cache is enough.
- **No N+1 mitigations beyond Prisma `include`** — every `include` is one row-set, joined client-side. If a page grows past ~20 rows of heavy related data, switch to selective `select` instead of `include`.
- **No automated tests yet** — visibility scoper and role-based view tests are tracked under Phase 4 "Deferred infrastructure work" in `CLAUDE.md`. They need a test framework setup (Vitest + a Postgres test instance, ideally Testcontainers or a dedicated branch in the seed flow) before useful tests can land.

## When to revisit

Re-audit the slowest routes if any of these change:

1. Daily-user count moves past 200 (the original "mature scale" target).
2. Visibility rules grow more clauses — currently a Director hits up to 4 OR-clauses; more than ~8 should switch to a materialised view or recursive CTE.
3. A new list page is built — give it a `loading.tsx`, and check the query count against the budget table above.
