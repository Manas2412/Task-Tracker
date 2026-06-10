# Product Requirements Document
## Sports Ministry Task Tracker & Workflow Management Tool

**Version:** 1.1 (updated after prototyping rounds)
**Owner:** OSD, Ministry of Youth Affairs & Sports
**Build platform:** Lovable (with four prototypes prepared as visual reference)
**Target scale:** 50–100 daily users initially; 100–200 at maturity
**Geography & timezone:** India only; Asia/Kolkata (IST)
**Phase:** Testing (with mock data) → Operational (mock data deleted on go-live)

---

## 1. Overview

A mobile-first task tracking and workflow management application for the Joint Secretary's office at the Ministry of Youth Affairs and Sports. The tool manages tasks, important files, and people across multiple divisions, sub-divisions, sections, PMUs, and a clear hierarchical officer chain.

The goal is a **simple, fast, mobile-friendly system** that gives the JS and OSD a clear central view of everything in motion, while allowing officers across all levels to create, assign, comment on, and complete tasks without friction.

---

## 2. Organisational Structure

### 2.1 Divisions (initial set)

- Khelo India Division
- Khelo India Mission *(treated as a separate division for now; 9 sub-divisions, names added via Super Admin Console)*
- Autonomous Bodies *(sub-divisions: NADA, NDTL, NCSSR, SAI; SAI has further sections)*
- Sports Goods Manufacturing
- Media and IT

### 2.2 Structural depth

```
Division → Sub-division → Section
```

Every division can optionally have a corresponding **PMU (Project Management Unit)** — a consultant company team supporting that division.

Super Admin can add, rename, or restructure divisions, sub-divisions, sections, and PMUs at any time via drag-and-drop.

### 2.3 Division avatar colour

Each division has a **stable avatar colour** assigned at creation. Officer avatars across the app inherit their division's colour, allowing officers to be scanned by division at a glance in any list. See Design Tokens for the initial colour assignments.

---

## 3. People & Roles

### 3.1 Ministry officer hierarchy (top → bottom)

1. Joint Secretary (JS)
2. Officer on Special Duty (OSD)
3. Director
4. Deputy Secretary
5. Under Secretary
6. Section Officer
7. Assistant Section Officer

### 3.2 Contract roles

Project Officer (PO), Assistant Project Officer (APO), Young Professional (YP), and similar contract-based roles.

At user creation, Super Admin assigns a **hierarchy slot** (matching one of the levels above) separately from the **designation** (the title shown in the UI). Permissions follow the slot.

**Visual treatment:** Contract roles are marked with a small badge ("PO" / "APO" / "YP") above the person's card; the slot below shows the corresponding regular slot (e.g. "Section Officer"). This keeps the permission model legible while preserving the actual designation.

### 3.3 PMU hierarchy

- PMU Senior Leadership
- Team Leader (on-site)
- Senior Consultant
- Consultant
- Intern

All ministry officers and PMU members are full users with logins.

### 3.4 System roles

| Role | Description |
|---|---|
| JS | Top of the pyramid; sees their own tasks and the OSD-curated Priority Board; primarily mobile |
| OSD | Sees everything (Command Centre); curates JS priorities; can toggle into Super Admin |
| Super Admin | Same person as OSD initially; full system control |
| Director / Dy. Sec / Under Sec / Section Officer / ASO | Standard hierarchy-based view |
| PMU members | See PMU-tagged tasks within their division only |

---

## 4. Permissions Model

Permissions are hierarchy-driven by default.

- A user sees their own tasks plus all tasks owned by anyone **below them in their chain**.
- A Director sees everything in their division (all sub-divisions, sections, subordinates).
- A Section Officer sees their section and everyone under them.
- **Ministry officers in a division can see their PMU's tasks** (collaboration).
- **PMU members see only PMU-tagged tasks in their division** — never internal ministry tasks unless explicitly added as a collaborator.
- Tasks with **Visibility: Personal** are visible only to the creator (not even to superiors).
- Tasks with **Visibility: Division** follow the hierarchy rules above.

---

## 5. Modules

### 5.1 Tasks (core)

#### Quick Create

- **Floating "+" button** at bottom-right on every screen.
- One field: **task name**. Tap Save → task is created.
- **"Add more details"** toggle expands inline for: due date, priority, owner, collaborators, division, description, attachments, recurrence, milestone toggle, visibility.
- Defaults when only name is typed:
  - Owner = creator
  - Division = creator's division
  - Status = Not Started
  - Visibility = Division

#### Task fields

| Field | Notes |
|---|---|
| Name | Required |
| Description / context | Free text; supports inline attachments |
| Created date | Auto |
| Due date | Optional |
| Owner | Single user; defaults to creator |
| Division leads | One officer per collaborating division (acts as collaborator with division-level accountability) |
| Collaborators | Multiple users |
| Status | Not Started / In Progress / Awaiting Input / On Hold / Completed *(Super Admin can add)* |
| Priority | Low / Medium / High / Urgent — set by anyone |
| JS Priority badge | OSD-controlled; carries the lane name (Today / This Week / This Month / Watchlist) |
| Visibility | Personal / Division — toggle on creation, editable later |
| Tags | Super Admin-managed list |
| Linked Timeline File | Optional, single |
| Milestone | Toggle; controls appearance in Milestone Calendar |
| Attachments | PDFs, images, docs — Lovable cloud upload or Google Drive link; inline preview |
| Comments | Thread with @mentions (status transitions are recorded here) |
| Subtasks | Full subtasks: each has its own owner, due date, status, comments, attachments |
| Recurrence | Daily / Weekly / Monthly / Quarterly / Half-yearly; Super Admin can add periods |

#### Co-owners (edge case)

Rare tasks needing multiple co-owners can have **up to 3 co-owners** with equal accountability.

#### Reassignment

- Owner can reassign **downward within their own chain** freely.
- **Sideways or upward** reassignment requires the superior's tap-approval.
- All reassignments logged in audit trail.

#### Deletion

- Creator can delete a task **only while it is solo** (no collaborators added, no comments).
- Once shared, "Delete" becomes **"Archive"** (soft-delete, hidden from lists, recoverable).
- Super Admin can hard-delete from the audit page.

#### Cross-division tasks

- Single **primary owner** (one person).
- **Division leads** (one per participating division) added as collaborators.
- Task appears in every participating division's list with a **"Primary: [Division Name]"** badge.
- All division leads notified at creation and at status change.

#### Section order on the task detail screen

The task detail screen presents sections in this fixed priority order (validated through Prototype v2):

1. **Title block** — status, priority, JS Priority, milestone badges + task name
2. **Context** — what this task is about
3. **Subtasks** — what needs to be done
4. **Linked timeline file** — where it came from
5. **Details** — owner, due, division, visibility, recurrence, tags
6. **Collaborators** — with inline Add button
7. **Attachments** — with inline Add button
8. **Comments** — discussion + @mentions + recorded status transitions
9. **Activity** — per-task activity log (see 5.1.5)

#### Status transitions inside comments

When a status change is performed alongside a comment, both are stored as a single event and rendered as a comment with an inline status-update card immediately below. This is the canonical way to "request" or "deliver" a status update — there is no separate "request status" UI; the @mention in the comment is the request, and the next replier's status change is the answer.

#### Per-task Activity log

Each task carries its own visible **Activity** section showing significant events on that task: status changes, JS Priority lane changes, ownership reassignment, milestone toggle, collaborator additions, Timeline File link, attachment uploads, etc. The most recent three events are visible; a "Show older activity" toggle expands the rest.

This is distinct from the system-wide Audit Trail (Super Admin page) — the per-task log is a user-facing convenience; the Audit Trail is the full, immutable, system-wide record.

---

### 5.2 Timeline Files

A tracker for important correspondence — letters, memos, references from the Minister, other ministries, external parties. Originates at Secretary, Sports level; mirror modules exist at JS and per-division.

#### Reference number convention

Every Timeline File has a unique reference number in the format **TF-YYYY/NNN** (e.g. TF-2026/34). Year is the year of creation; NNN is a sequential counter resetting annually. Displayed in monospace throughout the UI.

#### Who creates

OSD, or a staff member delegated by OSD.

#### Fields

| Field | Notes |
|---|---|
| Reference number | Auto-generated, format TF-YYYY/NNN |
| Subject | Required, free text |
| From whom received | Free text |
| Date received | Required |
| Duration / deadline | **Two input modes**: enter number of days OR a specific date — the other auto-computes. **Display rule:** both the absolute date and the "in N days / N days overdue" countdown are shown simultaneously |
| Marked to | One or more divisions |
| Source documents | Multiple uploads — the original correspondence and any supporting annexures |
| Action document | The final response sent in reply to this file, uploaded by the concerned section once action is taken. Shown as an inviting placeholder until uploaded |
| Secretary's comments | Free text, rendered as a quoted callout |
| Status | Pending Action / In Progress / Awaiting Reply / On Hold / Closed |
| Linked tasks | See below |
| Activity log | Same pattern as per-task activity log |

#### Visibility

- A Timeline File is **visible only to divisions it is marked to**.
- **OSD and JS see a master view** across all Timeline Files.

#### Task linking (Level 2 — one-way spawning)

- Inside a Timeline File: **"Create task from this file"** pre-fills the new task with the file's deadline, marked-to division, and a back-reference. Visibility defaults to Division.
- Timeline File detail page shows a panel of **all linked child tasks with their current statuses**, auto-refreshed for the Secretary's weekly review.
- The Timeline File's own status is **always manually set** — never auto-derived from child tasks.

#### Section order on the Timeline File detail screen

Validated through Prototype v3:

1. **Title block** — ref number, status, deadline countdown, subject, from / received
2. **Secretary's comments** — formal direction (serif quote callout)
3. **Linked tasks** — child tasks panel + "Create task from this file" button
4. **Source documents** — original correspondence
5. **Action document** — placeholder until uploaded, then the artefact of completion
6. **Details** — full meta (from, received, deadline, marked-to, created-by)
7. **Activity** — per-file activity log

#### Additional actions

The Timeline File menu offers: **Forward to division**, **Change marked-to**, **Share link**, **View audit trail**, **Archive**, **Delete** (Super Admin only).

---

### 5.3 JS Priority Board

OSD's curation surface; also the JS's home screen.

#### Lanes

- Today
- This Week
- This Month
- Watchlist

All four lanes are visible simultaneously on the board, laid out horizontally with horizontal swipe / scroll between them and a pager indicator at the bottom. (On JS's home screen, Today + This Week are the primary lanes shown.)

#### Mechanics

- **Drag-and-drop** tasks between lanes — OSD only.
- When a task enters any lane, it carries a **JS Priority badge** that propagates everywhere the task appears.
- Badge displays the lane name: "JS — today", "JS — this week", etc.
- Adding to any lane notifies: **task owner**, the relevant **Director**, and **Section Officer** (in-app bell + home screen pop-up).
- Tasks can be removed from a lane or moved to another lane via drag.

#### JS home screen layout

- Priority Board (Today + This Week visible by default; This Month + Watchlist via swipe or tab)
- Timeline Files summary (counts by status; tap to drill into the master view)
- Notifications bell

---

### 5.4 Milestone Calendar

A calendar view of important deadlines.

#### What appears

- Tasks with the **"Milestone" toggle on**.
- All **Timeline File deadlines**.

#### Views

- Month view (default)
- Week view
- List view (upcoming, chronological)

Visible to all users, scoped per their permissions.

---

### 5.5 Super Admin Console

OSD-only initially. Accessible via **role switcher** in the top bar of the app — single-click toggle between Super Admin and Command Centre.

The Super Admin Console is organised into six sub-sections:

| Sub-section | Purpose |
|---|---|
| **Structure & hierarchy** | Create / rename / restructure divisions, sub-divisions, sections, PMUs. Drag-and-drop officer hierarchy mapping per division. Unassigned officer pool. (Default landing page.) |
| **Users** | Create / edit / disable users. Set hierarchy slot, designation, contract role, division, sub-division, PMU flag. Initial password set by Super Admin and shared offline. |
| **Tags & labels** | Manage task tags, extended statuses, recurrence periods. |
| **Audit trail** | The full, system-wide record. Filterable by user, entity, date range. |
| **Bulk import** | Template-driven import of tasks into specific divisions. UI present in v1, feature-flag enabled when needed. |
| **Settings** | App-level configuration. |

#### Structure & hierarchy specifics

- **Three-column layout** on desktop: Structure tree (left), Hierarchy mapper (centre), Person inspector (right).
- **Hierarchy mapper** is a live org chart with drag-and-drop between sibling groups and across supervisor relationships.
- **Unassigned officers pool** below the chart — drag in to add to chain, drag out to remove.
- **Person inspector** updates on card click. Includes hierarchy-slot indicator ("Level N of 7"), reports-to/direct-reports with mini contact cards, username (monospace), last login, and action buttons (Edit details, Reset password, Change supervisor, Disable user).

#### Capabilities

- Create / edit / disable users.
- Set and reset passwords (see Onboarding & Account Management for the force-change rule at reset).
- Create / rename / restructure divisions, sub-divisions, sections, PMUs.
- Drag-and-drop hierarchy mapping.
- Manage tags / labels.
- Bulk import tasks (feature-flagged).
- Access audit trail.
- Unrestricted access to any page or view.

---

### 5.6 OSD Command Centre

OSD's default home view.

- All tasks across all divisions (filterable).
- JS Priority Board (curate / drag from here).
- Timeline Files master view.
- Notifications + mentions to OSD.
- Quick task creation available everywhere.
- Top-bar role switcher to flip into Super Admin Console.

---

### 5.7 Search & Filter

Available globally (search bar on every screen).

- **Search:** by task name, by owner name.
- **Filters:** status, division, priority, due date range, JS Priority on/off, Milestone on/off.
- **Timeline Files:** search by from-whom, marked-to division, status, reference number.

---

### 5.8 Audit Trail

Accessible from the Super Admin Console sub-section.

- Who changed what, when, on tasks and Timeline Files.
- User creation, role / hierarchy changes.
- Login events.
- Task and Timeline File deletions (archive vs hard-delete distinguished).
- Filterable by user, entity, date range.

---

## 6. Data Model (summary)

Key entities and their core fields:

- **User** — name, username, password_hash, designation, hierarchy_slot, contract_role *(null / PO / APO / YP)*, division_id, sub_division_id, section_id, is_pmu, pmu_role, supervisor_id, is_active, is_super_admin, last_login, created_at
- **Division** — name, parent_id *(for sub-divisions)*, has_pmu, avatar_colour, created_by, created_at
- **Task** — name, description, owner_id, division_id, status, priority, js_priority_lane *(null / today / week / month / watchlist)*, visibility, due_date, milestone, recurrence_rule, parent_task_id *(for subtasks)*, linked_timeline_file_id, created_by, created_at, archived
- **TaskCollaborator** — task_id, user_id, role *(collaborator / division_lead / co_owner)*
- **TaskComment** — task_id, user_id, body, mentions[], status_transition *(optional status id, recorded if comment accompanied a status change)*, created_at
- **TaskActivity** — task_id, actor_id, event_type, payload, created_at *(per-task user-facing log)*
- **Attachment** — owner_type *(task / timeline_file / comment)*, owner_id, file_url, source *(uploaded / drive_link)*, uploaded_by, uploaded_at
- **TimelineFile** — ref_no, subject, from_whom, received_date, deadline_date, marked_to_division_ids[], status, secretary_comments, action_document_id *(optional)*, created_by, created_at
- **TimelineFileLink** — timeline_file_id, task_id
- **TimelineFileActivity** — same pattern as TaskActivity
- **Notification** — user_id, type, payload, read, created_at
- **AuditLog** — actor_id, entity_type, entity_id, action, before, after, timestamp *(system-wide, immutable)*

---

## 7. Notifications

In-app bell only (no email / SMS in v1). Mobile-first delivery.

#### Triggers

- Task assigned to you
- You are @mentioned in a comment
- Status changed on your task by someone else
- JS Priority added to a task you own (and to the Director / Section Officer in that chain)
- Task due within 24 hours
- Task overdue
- Timeline File marked to your division
- Secretary added a comment on a Timeline File you own
- Cross-division tasks: division leads notified at creation and at any status change
- Reassignment requests (sideways / upward) — superior gets an approval notification
- Password reset by Super Admin

---

## 8. Design Language

A separate **Design Tokens & Patterns** document accompanies this PRD. Core principles:

- **Mobile-first**, with desktop reserved for Super Admin Console only.
- **Two-font system**: Manrope (body, UI) + Newsreader (headings, formal quotes).
- **Colour grammar**:
  - **Amber** = JS Priority signal (the OSD/JS hat).
  - **Indigo** = Super Admin surface, and Timeline File reference.
  - **Status pills always paired with icons** — colour is never the only signal (accessibility).
- **Sentence case** everywhere; no ALL CAPS in body content.
- **Sparse, calm UI** — minimal chrome, maximum focus on tasks and files.
- **Drag-and-drop** for priority lanes and hierarchy mapping (touch-friendly on mobile, mouse-friendly on desktop).
- **Inline previews** for PDFs and images.
- **Two-tap rule** — any frequent action should be reachable in two taps from the home screen.

See the Design Tokens document for specific colour values, type sizes, badge grammar, and the icon system.

---

## 9. Onboarding & Account Management

- Super Admin creates users (name, hierarchy slot, designation, contract role, division, sub-division, PMU flag) and sets the initial password.
- Credentials are shared offline (in person, SMS, official email).
- **No forced password change on first login** — user can change anytime from their profile.
- User can update their own password via Profile → Change Password.
- **If forgotten / reset by Super Admin:** the Super Admin can *optionally* tick "Force password change on next login" at the reset step. (Updated from PRD v1: this option was added to support security-sensitive reset scenarios while keeping initial onboarding friction-free.)
- Users can be disabled (login blocked) but not deleted, to preserve audit history.

---

## 10. Out of Scope (v1)

- Self-service sign-up.
- Email-based password reset.
- Email / SMS / WhatsApp notifications.
- JS personal notepad *(deferred to a future version)*.
- Two-way auto-sync between Timeline File status and linked task statuses.
- External API integrations (eOffice, DARPG portals, etc.).
- Full-featured bulk import (a basic template-driven version is acceptable in v1).
- Multi-language support.
- Offline mode.

---

## 11. Phased Build Suggestion (for Lovable)

**Phase 1 — Foundation**
- Super Admin Console: Structure & hierarchy + Users sub-sections; create users, divisions, hierarchy
- Login + profile + password change
- Task module: create, edit, comment, attach, recurrence, visibility, priority, subtasks
- Quick Create
- Per-task Activity log
- Search & basic filters

**Phase 2 — Coordination**
- JS Priority Board with drag-and-drop (horizontal multi-lane)
- OSD Command Centre
- Notifications
- Cross-division task UI
- Role switcher (Super Admin ↔ Command Centre)

**Phase 3 — Files & Calendar**
- Timeline Files module with Level 2 linking
- Per-Timeline-File Activity log
- Milestone Calendar
- Audit Trail page (full system-wide)
- Tags & Labels sub-section

**Phase 4 — Polish**
- Mobile gesture refinements
- Bulk import sub-section
- Performance hardening, role-based view tests
- Settings sub-section

---

## 12. Testing → Operational Transition

The application will be developed and tested with mock data — sample users, sample divisions (Khelo India Mission with placeholder sub-component names, indicative officer chain, sample Timeline Files, etc.). This allows the OSD and JS to validate the system end-to-end before live use.

On transition to operational use:

- All mock users, tasks, comments, attachments, and Timeline Files will be **purged**.
- Super Admin sets up real divisions, sub-divisions, and PMUs.
- Super Admin creates real user accounts and maps the real hierarchy.
- The system goes live with a clean slate; the audit trail begins from go-live date.

---

## 13. Visual Reference Prototypes

Four high-fidelity HTML prototypes accompany this PRD. They are the source of truth for visual design, interaction patterns, and micro-copy:

| Prototype | Surface | Viewport |
|---|---|---|
| Artifact 1 | Task list + Quick Create + JS Priority Board | Mobile (390px) |
| Artifact 2 | Task detail | Mobile (390px) |
| Artifact 3 | Timeline File detail | Mobile (390px) |
| Artifact 4 | Super Admin Console — Structure & hierarchy | Desktop (1280px) |

Remaining screens (login, profile, Milestone Calendar, OSD Command Centre dashboard, Notifications panel, Audit Trail page, the other Super Admin sub-sections) follow conventional patterns and can be built from this PRD plus the design tokens without further prototypes.

---

*End of PRD v1.1*
