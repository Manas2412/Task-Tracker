# Permissions Matrix

> Division-wide by default: every non-PMU ministry officer sees all division-visibility tasks in their own division from first login, regardless of hierarchy slot. Special rules layer on top for PMU isolation, personal visibility, cross-division tasks, headed-division access (delegations), and OSD's unrestricted access. Enforcement lives in the data-access layer (`buildVisibilityClausesFrom` in src/lib/visibility-rules.ts) — every read filters by the caller's division / PMU flag / headed divisions before returning rows. This document is the source of truth for what those helpers must implement.

---

## 1. Roles in the system

| Role | Hierarchy slot | Notes |
|---|---|---|
| Joint Secretary | `js` | Top of the chain. Sees own tasks + the OSD-curated JS Priority Board |
| Officer on Special Duty | `osd` | Sees everything in the ministry. Toggles into Super Admin |
| Director | `director` | Sees full division (sub-divisions, sections, subordinates) |
| Deputy Secretary | `deputy_secretary` | Sees own chain |
| Under Secretary | `under_secretary` | Sees own chain |
| Section Officer | `section_officer` | Sees section + everyone under |
| Assistant Section Officer | `aso` | Sees own tasks; no subordinates by definition |
| PMU member | (any PMU role) | Sees only PMU-tagged tasks in their division |
| Super Admin | (overlay) | Same person as OSD initially; unrestricted access to any page |

Contract roles (PO / APO / YP) are visual overlays on a hierarchy slot. **Permissions follow the slot, not the contract role.**

---

## 2. Matrix — Tasks

Each row is a permission. Each column is a role acting on a task they can see (either by ownership, collaboration, hierarchy, or PMU collaboration).

| | JS | OSD | Director | Dy. Sec | Under Sec | Section Officer | ASO | PMU member | Super Admin |
|---|---|---|---|---|---|---|---|---|---|
| **See own tasks** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **See own division — all division-visibility tasks** |  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PMU team only⁴ | ✓ |
| **See headed divisions (head or delegate)** |  | ✓ | if head³ | if head³ | if head³ | if head³ |  |  | ✓ |
| **See other divisions** |  | ✓ |  |  |  |  |  |  | ✓ |
| **See JS Priority Board** | ✓ | ✓ | partial² | partial² | partial² | partial² | partial² |  | ✓ |
| **See Personal-visibility tasks of others** |  |  |  |  |  |  |  |  | ✓ (audit only) |
| **Create task (personal visibility)** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (in own division, will be PMU-tagged) | ✓ |
| **Create division-level task** | head³ | ✓ | head³ | head³ | head³ | head³ | head³ | head³ | ✓ |
| **Work a task they own** (status, priority, description, subtasks) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Redefine a task** (name, due date, milestone, recurrence) — see §5.13 | ✓ | ✓ | own div | head³ | head³ | head³ | head³ | head³ | ✓ |
| **Edit any task they can see** |  | ✓ |  |  |  |  |  |  | ✓ |
| **Comment / @mention on tasks they can see** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Change status on task they own / collaborate on** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Reassign owner from the Owner row** | head³ | ✓ | head³ | head³ | head³ | head³ | head³ | head³ | ✓ |
| **Approve reassignment requests** | for own subordinates | for own subordinates | for own subordinates | for own subordinates | for own subordinates | for own subordinates |  |  | ✓ (any) |
| **Transfer task to same-division user (with comment)** | own | own | own | own | own | own | own | own | own |
| **Add collaborators** | ✓ (own/visible) | ✓ | ✓ (own/visible) | ✓ (own/visible) | ✓ (own/visible) | ✓ (own/visible) | ✓ (own) | ✓ (PMU-tagged) | ✓ |
| **Add cross-division collaborators (division leads)** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |  | ✓ |
| **Set JS Priority lane** |  | ✓ |  |  |  |  |  |  | ✓ |
| **Toggle milestone** | own | ✓ | own | own | own | own | own | own | ✓ |
| **Toggle visibility** | head³ | ✓ | head³ | head³ | head³ | head³ | head³ | head³ | ✓ |
| **Delete task (hard-delete)** — own personal always; division task see §5.13 | head³ | head³ | head³ | head³ | head³ | head³ | head³ | head³ | ✓ (any) |
| **Archive shared task** | own | ✓ | own | own | own | own | own | own | ✓ (any) |
| **Restore archived task** |  | ✓ |  |  |  |  |  |  | ✓ |

¹ "Needs approval" = the request is created; the proposed new owner's superior must tap-approve before the reassignment takes effect.
² "partial" = only sees tasks owned by self or own subordinates that happen to be on the board, plus the visible-to-them JS Priority badge on every task they can already see. The full board is OSD + JS + Super Admin.

³ "head" = only when the user is that division's head (`divisions.head_user_id`) or holds an active `division_access_delegations` row for it — the hierarchy slot itself grants nothing. Giving tasks on a division's board is a head power; everyone else creates personal tasks (see §5.11).

⁴ PMU members see only their PMU team's division-visibility tasks (`ownerId IN <pmu team>`), never the full division board. See §5.2.

---

## 3. Matrix — Timeline Files

Timeline Files are visible only to divisions they are marked to, plus OSD/JS via the master view.

| | JS | OSD | Director of marked division | Other officers of marked division | Officers of unmarked divisions | PMU member of marked division | Super Admin |
|---|---|---|---|---|---|---|---|
| **See Timeline File** | ✓ (master) | ✓ (master) | ✓ | ✓ (per their chain) |  |  | ✓ |
| **Create Timeline File** |  | ✓ (or delegate) |  |  |  |  | ✓ |
| **Edit subject / from / received date / deadline / marked-to** |  | ✓ | ✓ |  |  |  | ✓ |
| **Change status** |  | ✓ | ✓ |  |  |  | ✓ |
| **Add / edit Secretary's comments** |  | ✓ |  |  |  |  | ✓ |
| **Upload source documents** |  | ✓ | ✓ |  |  |  | ✓ |
| **Upload action document** |  | ✓ | ✓ | ✓ (officer of section taking action) |  |  | ✓ |
| **Spawn task from Timeline File ("Create task from this file")** | head³ | ✓ | head³ | head³ |  |  | ✓ |
| **Forward to division / change marked-to** |  | ✓ |  |  |  |  | ✓ |
| **Share link (read-only)** | ✓ | ✓ | ✓ |  |  |  | ✓ |
| **Archive** |  | ✓ |  |  |  |  | ✓ |
| **Hard-delete** |  |  |  |  |  |  | ✓ |

Timeline File status is **always manually set** — never auto-derived from linked task statuses.

---

## 4. Matrix — Super Admin Console

| Sub-section | OSD | Super Admin | Anyone else |
|---|---|---|---|
| Structure & hierarchy | (toggle into Super Admin) | ✓ |  |
| Users | (toggle into Super Admin) | ✓ |  |
| Tags & labels (Phase 3) | (toggle into Super Admin) | ✓ |  |
| Audit trail (Phase 3) | (toggle into Super Admin) | ✓ |  |
| Bulk import (Phase 4) | (toggle into Super Admin) | ✓ |  |
| Settings (Phase 4) | (toggle into Super Admin) | ✓ |  |

The role switcher in the top bar is the only entry point. OSD and Super Admin are the same person initially; the switcher just flips the surface. The capability is gated by `users.is_super_admin = true`.

---

## 5. Special rules

### 5.1 Personal visibility

- `visibility = 'personal'` makes the task visible to **exactly three sets of people, and no one else**: the **creator** (e.g. a Division Head or Super Admin who set it Personal and assigned it out), the **assigned owner**, and users **explicitly added as collaborators**. It is invisible to everyone else — other division members, and division heads / OSD / Super Admins who are none of the above — including in lists, dashboards, search, the calendar, and every task view.
- Enforced by the three base clauses in `buildVisibilityClausesFrom` (`ownerId` / `collaborators` / `createdById + visibility:'personal'`); every role clause is gated on `visibility:'division'`, so no role ever matches a Personal task. Dashboards (Command Centre, JS Dashboard) restrict their ministry-wide aggregates to `visibility:'division'` so a Personal task cannot leak into a count or list there either.
- Super Admin / OSD do **not** see others' Personal tasks in the regular lists — only via the audit trail (for compliance).
- The task appears in the **Personal Tasks** list of each eligible viewer. Subtasks inherit visibility from the parent task — a subtask cannot be more permissive than its parent.

### 5.2 PMU isolation

- A PMU is a sibling row in `divisions` with `kind = 'pmu'` and `pmu_parent_division_id` pointing to its supporting ministry division. PMU membership is `users.pmu_id`; everyone sharing a `pmu_id` is one PMU team.
- **A PMU team member sees their PMU team's tasks and nothing else of the division**: division-visibility tasks owned by anyone in their PMU (themselves + teammates), plus any task they own or are a collaborator on. They **never see the division board** — the internal ministry tasks are invisible to them.
- Enforced in the scoper (`buildVisibilityClausesFrom`, src/lib/visibility-rules.ts): the PMU branch emits an owner-scoped clause `{ visibility: 'division', ownerId: { in: <pmu member ids> } }` instead of the division-wide clause. Teammate ids come from `getPmuTeammateIds` (src/lib/visibility.ts). Personal tasks of teammates stay private (the clause is gated on `visibility: 'division'`).
- The reverse is permitted: ministry officers in a division see their PMU's tasks freely (the PMU members' tasks live in the division, so a division user's board already includes them).
- A PMU member holding an active delegation additionally sees the delegated division for the window, on top of their PMU team's tasks.
- On the `/tasks` board a PMU member's second segment is labelled "Other tasks of my PMU team" rather than "…of my division".

### 5.3 Cross-division tasks

- Single **primary owner** (one person, the `tasks.owner_id`).
- One **division lead** per participating division, added via `task_collaborators.role = 'division_lead'`.
- The task appears in every participating division's list with a **"Primary: [Division Name]"** badge.
- All division leads notified at creation and at every status change.
- Division leads may comment and edit the task as collaborators; they cannot change ownership.

### 5.4 OSD unrestricted access

- OSD sees everything across all divisions — the Command Centre.
- OSD can edit any task they can see (the only non-Super-Admin role with this power).
- OSD adds, removes, and reorders JS Priority lanes (exclusive control).
- OSD is the default creator of Timeline Files.

### 5.5 JS view

- JS's home is the JS Priority Board (Today + This Week visible by default; This Month + Watchlist via swipe).
- JS sees their own tasks plus everything on the Priority Board.
- JS does not see division-internal tasks unless they appear on the Priority Board or list them as owner/collaborator.

### 5.6 Reassignment

- **Who can reassign from the Owner row** — only **Super Admin, OSD, or the head of the task's division** (direct head or active delegate). The Owner row is read-only for everyone else, including the task's own owner and creator: a normal user changes ownership through **Transfer task** (below), not the Owner row. Enforced in `reassignTaskAction` (`mayInitiate`) and mirrored by `canReassign` on the task page.
- **Downward within own chain** — applies immediately. Log to `task_activity` and `audit_log`. No notification to the previous owner beyond the activity log entry.
- **Sideways or upward** — creates a `reassignment_requests` row with `approver_id` = the proposed new owner's superior. The superior receives a notification of type `reassignment_approval_requested`. On approval, the reassignment applies and a `reassignment_approved` notification fires to the requester; on rejection, `reassignment_rejected` fires.
- **Same-division transfer (by current owner)** — the task owner can transfer ownership to any active user in the same division without approval, and **must supply a comment** explaining the hand-off (the sheet offers one-tap reasons — "On leave", "This work belongs to another official", "Delegating it" — or free text). `ownerId` updates immediately; `createdById` stays unchanged. If the task had `personal` visibility, it flips to `division`. Activity log records `task_transferred` with `{from, to}`. The new owner receives `task_assigned`; the original creator (if different from both parties) receives `task_transferred`.
- The reassignment picker UI marks rows that would require approval with an amber "Approval needed" badge. The transfer button is separate — a prominent card visible only to the current task owner.

### 5.7 Deletion vs archive

| Condition | Available action | Who |
|---|---|---|
| Task — delete (hard) | **Delete** (removes the task, its subtasks, comments, collaborators, and attachments; cannot be undone) | Owner or creator; the **head of the task's division** (direct head or active delegate); **Super Admin** for any task |
| Task — archive | **Archive** (soft-delete, recoverable, hidden from lists) | Anyone with edit rights (owner, creator, director/head of the division, OSD, JS, Super Admin) |
| Timeline File — archive | ✓ | OSD, Super Admin |
| Timeline File — hard-delete | ✓ | Super Admin only (any file, regardless of creator) |
| User | **Disable** (login blocked, audit history preserved) | Super Admin only |
| User — hard-delete |  | Not supported — would break the audit trail |

Archived items remain in the database and surface via the audit trail. The Super Admin can restore an archived task or file.

### 5.8 Status change on subordinate's task

- A superior can change the status of a subordinate's task that they can see.
- The change is logged to `task_activity` with the superior as the actor; the owner receives a `status_changed_on_my_task` notification.

### 5.9 @mention reach

- A user can `@`-mention only people they can see (mention picker is scoped by visibility).
- Mentioning a user automatically grants them read access to **this specific task** only, even if they would not otherwise see it. They appear as an implicit collaborator until removed.

### 5.10 Bootstrap account

- The first Super Admin account is created by the deployer (out-of-band).
- That account has `is_super_admin = true` and `hierarchy_slot = 'osd'`.
- No other Super Admin can exist until that account creates one and ticks the Super Admin Access toggle in the inspector.

### 5.11 Division-level task creation is a head power

- Only **Super Admin**, **OSD**, a division's **head** (`divisions.head_user_id`), or an **active delegate** (an unrevoked `division_access_delegations` row whose inclusive window covers now) may create a task with `division` visibility in that division. Enforced in `createTaskAction` via `canCreateDivisionTask` (src/lib/rbac/rules.ts).
- Everyone else creates **personal** tasks only; the Quick Create sheet does not offer the Division option to them and defaults to Personal.
- The same rule gates **changing** a task's visibility in either direction (`updateTaskFieldsAction`) — an owner may not promote a personal task onto the division board, nor hide a division task.
- Spawning a task from a Timeline File always produces a division-level task, so the same rule applies there; the former "any viewer of the file" exception is removed.
- Subtasks still inherit the parent's visibility — an owner breaking down a head-given division task produces division-visible subtasks by design.
- Known residual path: a same-division ownership transfer of a `personal` task still auto-flips it to `division` (§5.6) so it does not vanish from the recipient's view.

### 5.12 JS Engagements (Office of JS meetings on the calendar)

The planning calendar (`/calendar`) shows three item kinds — **JS engagements** (teal), **task deadlines** (dark blue), and **Timeline file deadlines** (red). Tasks and Timeline files reuse their existing visibility scopers (`buildVisibilityClauses`, `buildTfVisibilityClause`), so a division user sees only their division's task deadlines and a PMU member only their team's (§5.2) — calendar and lists stay consistent.

JS Engagements are the Office of JS's own layer:

- **Seeing and managing engagements is limited to Office-of-JS members and Super Admins.** "Office-of-JS member" = `users.division_id` equals the seeded `Office of JS` division. Everyone else does not see engagements on the calendar at all, and cannot create or edit them.
- Both gates are the single predicate `canAccessEngagements` (src/lib/engagements.ts); the server actions (`createEngagementAction` / `updateEngagementAction` / `deleteEngagementAction` / `getEngagementDetail`) re-check it from the DB.
- Fields: title (required), date + start time (required; stored as one `starts_at` instant, IST wall-clock), venue or meeting link (optional), participants (existing active users), MoM notes, and optional attachment links. Attachments reuse the polymorphic `attachments` table (`owner_type = 'js_engagement'`).
- Every engagement is anchored to the Office of JS division, so the caller's own membership is the only visibility gate needed.
- From any date the calendar offers quick actions: **Add JS engagement** (managers only), **Create task** (opens Quick Create pre-dated), and **Create timeline file** (OSD / Super Admin). Clicking a task/TF opens its page; clicking an engagement opens its detail sheet with edit/delete for managers.

### 5.13 Working a task vs redefining it (owner ≠ editor)

Owning a task lets you **work** it, not **redefine** it. This matters after a transfer: the new owner is often a normal user, and simply becoming owner must not hand them control of the task's definition.

- **A normal user (even the owner) cannot**: delete the task, or edit its **name**, **due date**, **milestone**, or **recurrence**. These are gated by `canEditTaskDetails` / the delete guard — Super Admin, OSD, JS, a director of the division, or its head. (A user's **own personal task** stays fully theirs to edit and delete.)
- **The owner (and creator) can still**: change **status** and **priority**, edit the **description**, comment, and manage **subtasks** — including **reassigning a subtask** to someone else.
- **Subtask reassignment is logged with full detail**: `updateSubtaskAction` records a `subtask_updated` activity event carrying the subtask, the previous and new assignee (`fromName` / `toName`), and the actor; the activity log renders it as "‹actor› reassigned subtask ‹name› to ‹assignee› on ‹date, time›".
- Enforced on both sides: the task page hides the restricted controls (`canEditDetails`, `canDelete`), and the server actions (`updateTaskFieldsAction`, `deleteTaskAction`) re-check, so a stale client or direct call cannot bypass them.

### 5.14 Division / PMU assignment resolves ownership from Structure & Hierarchy

Placing a task in a Division or PMU **auto-assigns its owner** from Structure & Hierarchy (the single source of truth) — creators do not pick an owner.

- **Division selected → owner = the division's Head** (`divisions.head_user_id`).
- **PMU selected → owner = that PMU's Team Leader** (the active user with `pmuRole = 'pmu_team_leader'` and `pmuId =` the PMU). Because the scoper shows every PMU member the tasks owned by a PMU teammate (§5.2), assigning ownership to the Team Leader makes the task **visible to the whole PMU team** automatically.
- **No head / no team leader → falls back to the creator** as owner (never blocks).
- Resolved by `resolveDivisionOwner` (src/lib/rbac). Applied at **creation** (`createTaskAction`, for `division`-visibility tasks) and on **re-assignment** (`updateTaskFieldsAction`, when the Division/PMU changes — which reassigns ownership, logs an `owner_changed` activity event, and notifies the new owner). Personal tasks stay owned by their creator.
- The Division/PMU selector is populated from Structure & Hierarchy (divisions + their PMUs): the create form's picker (heads see divisions they head + those PMUs; OSD/Super Admin see all), the task-detail **Change division** control, and the `/tasks` division filter. Everything downstream — visibility, dashboards, filters, notifications — follows because it keys off the resulting `divisionId` / `ownerId`.
