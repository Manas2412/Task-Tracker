# Mock Data Spec — Phase 1

> This is a **spec for seeding**. Do not seed yet — Postgres and Prisma are not wired. When Phase 1 wiring is ready, implement `prisma/seed.ts` so `pnpm prisma db seed` produces exactly this shape. On the testing-to-operational cutover (PRD §12), purge all mock data and let Super Admin set up real divisions and users.

All dates are illustrative — pin them to "today" at seed-time so the relative state (overdue / due-today / due-soon) lands correctly. The reference "today" used throughout this spec is **2026-06-02**.

---

## 1. Divisions (2)

| Key | Name | Kind | Parent | `has_pmu` | Avatar token |
|---|---|---|---|---|---|
| `khi` | Khelo India Division | division | — | true | `--division-khelo-india-division` (`#4338ca`) |
| `ab` | Autonomous Bodies | division | — | false | `--division-autonomous-bodies` (`#047857`) |

Sub-divisions (illustrative; needed so the user's `sub_division_id` can resolve):

- **`khi`** has sub-division `khi-operations` (Operations)
- **`ab`** has sub-divisions `ab-nada` (NADA), `ab-ncssr` (NCSSR), `ab-sai` (SAI)

PMU row (sibling, `kind = 'pmu'`, `pmu_parent_division_id = khi`):

- `khi-pmu` — "KIM PMU" — avatar `--division-khelo-india-mission` (`#b45309`)

---

## 2. Users (10 total)

Covering all 7 hierarchy slots + 2 contract roles + Khelo India Division PMU members.

### Ministry officers (7)

| Key | Name | Hierarchy slot | Designation | Division | Sub-division | Supervisor | Contract |
|---|---|---|---|---|---|---|---|
| `u-js` | Vivek R. | `js` | Joint Secretary | Office of JS | — | — | — |
| `u-osd` | OSD (you) | `osd` | Officer on Special Duty | Office of JS | — | `u-js` | — |
| `u-dir-khi` | Ravi Kumar | `director` | Director, Khelo India Division | khi | — | `u-osd` | — |
| `u-dys-khi` | Suresh S. | `deputy_secretary` | Deputy Secretary | khi | khi-operations | `u-dir-khi` | — |
| `u-us-khi` | Pooja D. | `under_secretary` | Under Secretary | khi | khi-operations | `u-dys-khi` | — |
| `u-so-khi-yp` | Sneha T. | `section_officer` | Young Professional (SO slot) | khi | khi-operations | `u-us-khi` | `yp` |
| `u-aso-khi` | Meena P. | `aso` | Assistant Section Officer | khi | khi-operations | `u-us-khi` | — |

### Autonomous Bodies officers (2)

| Key | Name | Hierarchy slot | Designation | Division | Sub-division | Supervisor | Contract |
|---|---|---|---|---|---|---|---|
| `u-dir-ab` | Anita M. | `director` | Director, Autonomous Bodies | ab | — | `u-osd` | — |
| `u-us-ab-po` | Rohit M. | `under_secretary` | Project Officer (Under Sec slot) | ab | ab-sai | `u-dir-ab` | `po` |

### Khelo India PMU members (3)

`is_pmu = true`, `division_id = khi`.

| Key | Name | PMU role | Designation |
|---|---|---|---|
| `p-tl` | Karan V. | `pmu_team_leader` | Team Leader (KIM PMU) |
| `p-sc` | Lekha R. | `pmu_senior_consultant` | Senior Consultant (KIM PMU) |
| `p-c` | Aditya N. | `pmu_consultant` | Consultant (KIM PMU) |

**Totals:** 10 users (7 ministry + 3 PMU). Two contract roles present: 1 PO (`u-us-ab-po`) and 1 YP (`u-so-khi-yp`).

`u-osd.is_super_admin = true`; everyone else `false`.

---

## 3. Timeline Files (3)

| Ref no | Subject | From | Received | Deadline | Status | Marked to | Linked tasks |
|---|---|---|---|---|---|---|---|
| `TF-2026/34` | Cabinet brief request — Khelo India Mission | Prime Minister's Office | 2026-05-18 | 2026-06-05 (in 3 days) | `in_progress` | khi | 3 linked tasks (`t-cabinet`, `t-brief-js`, `t-mof`) |
| `TF-2026/38` | NADA compliance review note | Ministry of Health | 2026-05-25 | 2026-06-09 (in 7 days) | `pending_action` | ab | 0 linked tasks initially |
| `TF-2026/22` | Asian Games delegation confirmation | Indian Olympic Association | 2026-04-12 | 2026-04-30 | `closed` | khi, ab | 1 linked task (`t-asian-games`), already completed |

Secretary's comments populated on `TF-2026/34` only (sample text, two sentences max, in plain English — matches prototype copy).

`TF-2026/34` has 2 source documents (PMO note + Annexure I) and no action document. `TF-2026/22` has 1 source document and 1 uploaded action document. `TF-2026/38` has 1 source document, no action document.

Created by `u-osd` for all three.

---

## 4. Tasks (18 total)

A mix sized to exercise every list-screen state plus all four JS Priority lanes.

### JS Priority tasks (one per lane = 4)

| Key | Name | Owner | Division | Status | Priority | JS lane | Due | Milestone | Linked TF | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `t-cabinet` | Finalise Khelo India Mission cabinet note | `u-dir-khi` | khi | `in_progress` | `urgent` | `today` | 2026-06-02 18:00 | true | `TF-2026/34` | Reference task. Has 4 subtasks (2 done), 5 comments, 3 attachments |
| `t-media-launch` | Media campaign rollout — Khelo India launch | `u-dir-khi` | khi | `in_progress` | `high` | `week` | 2026-06-06 | true | — | 8 subtasks (4 done) |
| `t-quarterly-ab-review` | Quarterly autonomous bodies review meeting | `u-dir-ab` | ab | `not_started` | `high` | `month` | 2026-06-22 | true | — | — |
| `t-pmu-contract-restructure` | Restructure Khelo India Mission PMU contract | `u-osd` | khi | `not_started` | `high` | `watchlist` | 2026-07-25 | true | — | — |

### Other open tasks (13)

| Key | Name | Owner | Division | Status | Priority | Due | Linked TF |
|---|---|---|---|---|---|---|---|
| `t-brief-js` | Brief JS on Asian Games delegation list | `u-dys-khi` | khi | `awaiting_input` | `high` | 2026-06-02 16:00 (today) | — |
| `t-mof` | Coordinate MoF inputs for indicative outlay | `u-dir-ab` | ab | `in_progress` | `medium` | 2026-06-03 | `TF-2026/34` |
| `t-sai-audit` | SAI Q3 infrastructure audit report | `u-dir-ab` | ab | `in_progress` | `high` | 2026-06-03 | — |
| `t-nada-review` | Review NADA quarterly compliance report | `u-dir-ab` | ab | `awaiting_input` | `medium` | 2026-05-30 (**overdue**) | — |
| `t-pmu-monthly` | Coordinate PMU monthly review — Khelo India | `u-dir-khi` | khi | `in_progress` | `medium` | 2026-06-05 | — |
| `t-ncssr-list` | NCSSR research project list — update | `u-dir-ab` | ab | `in_progress` | `low` | 2026-06-15 | — |
| `t-pib-release` | PIB press release — Khelo India sub-component launch | `u-dir-khi` | khi | `on_hold` | `medium` | 2026-06-18 | — |
| `t-sai-uniform` | Procure athletics team uniforms | `u-us-ab-po` | ab | `not_started` | `medium` | 2026-06-10 | — |
| `t-khi-vendor` | Vet PMU vendor empanelment list | `u-us-khi` | khi | `in_progress` | `low` | 2026-06-12 | — |
| `t-osd-personal` | Prepare JS briefing notes (personal) | `u-osd` | Office of JS | `not_started` | `low` | 2026-06-04 | — |
| `t-aso-filing` | File May returns to DG&CA | `u-aso-khi` | khi | `not_started` | `low` | 2026-06-08 | — |
| `t-pmu-vendor-tracker` | KIM PMU — vendor tracker monthly refresh | `p-c` | khi | `in_progress` | `low` | 2026-06-07 | — |
| `t-pmu-state-engage` | KIM PMU — state engagement plan v3 | `p-tl` | khi | `awaiting_input` | `medium` | 2026-06-13 | — |

### Completed (closed-loop check)

| Key | Name | Owner | Division | Status | Linked TF |
|---|---|---|---|---|---|
| `t-asian-games` | Finalise Asian Games delegation paperwork | `u-dys-khi` | khi | `completed` | `TF-2026/22` |

**Totals:** 18 tasks (4 JS-priority + 13 other-open + 1 completed). JS Priority distribution: 1 each in `today`, `week`, `month`, `watchlist` (4 total). Statuses across the 18: 5 `not_started`, 6 `in_progress`, 3 `awaiting_input`, 1 `on_hold`, 1 `completed`, plus 1 personal-visibility on the OSD's plate (counted in `not_started`). Overdue: 1 (`t-nada-review`). Owners distributed across all 7 hierarchy slots and the PMU.

### Visibility

- All tasks `visibility = 'division'` **except** `t-osd-personal` which is `personal` (only `u-osd` sees it). This is the visibility-rule canary.

### Subtasks (on `t-cabinet` only — reference for the task detail screen)

| Subtask | Owner | Status |
|---|---|---|
| Draft outline structure with 9 sub-components | `u-dir-khi` | `completed` |
| Stakeholder map: PMO, MoF, SAI, NSFs | `u-dir-ab` | `completed` |
| Cost analysis with MoF inputs | `u-dys-khi` | `in_progress` |
| Draft v2 — review with JS before circulation | `u-dir-khi` | `not_started` |

Each subtask is a full task row with `parent_task_id = t-cabinet`.

### Collaborators (on `t-cabinet`)

| Collaborator | Role |
|---|---|
| `u-dys-khi` | `division_lead` |
| `u-dir-ab` | `division_lead` |
| `u-osd` | `collaborator` |
| `u-us-ab-po` | `collaborator` |

(Two division leads exercise the cross-division-task badge requirement.)

### Comments (on `t-cabinet` — 5)

Match the prototype copy in `prototypes/myas_task_detail_prototype.html` lines 1319–1381 verbatim, with author keys remapped:

1. `u-dir-khi` — "Draft v2 is ready. @u-dys-khi can you add the cost figures from MoF before EoD? @u-osd sharing for your visibility."
2. `u-dys-khi` — "On it. MoF shared their numbers this morning. Will update the draft and share by 5 pm." (`status_transition = 'in_progress'` — exercises the inline status-update card)
3. `u-osd` — "Added to JS priority — today. @u-dir-khi please ensure JS sees the final before circulation."
4. `u-dir-ab` — "SAI inputs incorporated in section 4.2. Diagram uploaded to Drive."
5. `u-dir-khi` — "Thanks @u-dir-ab. Final draft will be circulated by 5:30 pm."

### Attachments (on `t-cabinet` — 3)

| Name | Source | Uploaded by |
|---|---|---|
| `cabinet-note-draft-v2.pdf` | `uploaded` | `u-dir-khi` |
| `cost-analysis-mof.pdf` | `uploaded` | `u-dys-khi` |
| `Mission architecture diagram` | `drive_link` | `u-dir-ab` |

### Activity (on `t-cabinet` — at least 8 events)

So the "Show older activity (5)" toggle is exercised (top 3 visible, 5 older). Generate from the comments + the JS-Priority addition + collaborator additions + milestone toggle + Timeline File link + 2 attachment uploads.

---

## 5. Seed ordering

Insert in this order to satisfy foreign keys:

1. `divisions` (top-level first, then sub-divisions, then PMU sibling rows)
2. `users` (JS first; everyone else can reference each other after all rows exist — defer `supervisor_id` to a second pass if needed)
3. `tags` (none required for Phase 1)
4. `timeline_files` (without `action_document_attachment_id`)
5. `attachments` (source + action documents)
6. `timeline_files` UPDATE — set `action_document_attachment_id` where applicable
7. `timeline_file_marked_to`
8. `tasks` (parents first, then subtasks)
9. `task_collaborators`
10. `task_comments` (set `status_transition` where flagged)
11. `task_activity`
12. `timeline_file_task_links` (mirror of `tasks.linked_timeline_file_id`; populate from the trigger or seed both)
13. `timeline_file_activity`

---

## 6. Post-seed verification checks

After seeding, the following should hold without writing application code:

- `SELECT COUNT(*) FROM users` → 10
- `SELECT COUNT(*) FROM tasks WHERE archived_at IS NULL AND parent_task_id IS NULL` → 18 (top-level only; subtasks counted separately)
- `SELECT COUNT(*) FROM tasks WHERE js_priority_lane = 'today'` → 1
- `SELECT COUNT(*) FROM tasks WHERE js_priority_lane = 'week'` → 1
- `SELECT COUNT(*) FROM tasks WHERE js_priority_lane = 'month'` → 1
- `SELECT COUNT(*) FROM tasks WHERE js_priority_lane = 'watchlist'` → 1
- `SELECT COUNT(*) FROM tasks WHERE status = 'completed'` → 1
- `SELECT COUNT(*) FROM tasks WHERE due_date < now() AND status NOT IN ('completed') AND archived_at IS NULL` → 1
- `SELECT COUNT(*) FROM tasks WHERE visibility = 'personal'` → 1
- `SELECT COUNT(*) FROM tasks WHERE parent_task_id IS NOT NULL` → 4 (the four subtasks on `t-cabinet`)
- `SELECT COUNT(*) FROM timeline_files` → 3
- `SELECT COUNT(*) FROM timeline_file_marked_to` → 4 (1 + 1 + 2)
- `SELECT COUNT(*) FROM task_collaborators WHERE task_id = (SELECT id FROM tasks WHERE name LIKE 'Finalise Khelo India Mission%')` → 4
- `SELECT COUNT(*) FROM task_comments WHERE task_id = (… same …)` → 5
- `SELECT COUNT(*) FROM task_comments WHERE status_transition IS NOT NULL` → 1

If any of these miss, the seed is wrong.

---

## 7. Cutover purge

When the system moves from testing to operational (PRD §12):

```sql
TRUNCATE task_activity, timeline_file_activity, task_comments,
         task_collaborators, task_tags, timeline_file_task_links,
         timeline_file_marked_to, attachments, tasks, timeline_files,
         notifications, reassignment_requests RESTART IDENTITY CASCADE;

DELETE FROM users WHERE id IN (
  SELECT id FROM users WHERE created_by IS NOT NULL  -- keep the bootstrap Super Admin
);

DELETE FROM divisions WHERE id IN (
  SELECT id FROM divisions WHERE created_by IS NOT NULL
);

-- audit_log is preserved across the cutover; the new operational log
-- continues from go-live, with a manual marker row inserted:
INSERT INTO audit_log (actor_id, entity_type, entity_id, action, before, after)
VALUES (
  '<bootstrap super admin id>', 'system', '00000000-0000-0000-0000-000000000000',
  'create', '{}'::jsonb,
  jsonb_build_object('event', 'operational_cutover', 'note', 'mock data purged; live operation begins')
);
```

The Super Admin then creates real divisions, sub-divisions, PMUs, and users via the console.
