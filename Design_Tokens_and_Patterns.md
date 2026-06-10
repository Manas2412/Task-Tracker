# Design Tokens & Patterns
## MYAS Task Tracker — companion to PRD v1.1

This document captures the visual and interaction language established in the four prototypes. It is the source of truth for colour, typography, badge grammar, iconography, copy rules, and component behaviour. Hand this to the designer / builder alongside the PRD.

---

## 1. Colour System

### 1.1 Neutrals — surfaces and ink

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#f5f4f0` | Page background (warm off-white) |
| `--canvas` | `#fafaf7` | Secondary canvas (e.g. inside a layout grid) |
| `--panel` | `#ffffff` | Cards, sheets, panels |
| `--ink` | `#1a1a1a` | Primary text, primary buttons |
| `--ink-2` | `#525252` | Secondary text, section headings |
| `--ink-3` | `#8a8a8a` | Tertiary text, metadata |
| `--ink-4` | `#b8b6ae` | Disabled, dividers in some places |
| `--line` | `#e8e6df` | Standard border / divider |
| `--line-2` | `#efedf0` | Subtle divider |

### 1.2 Brand accents — the two signals

The system has exactly two accent colours, each with a specific meaning. **Never use them interchangeably.**

| Token | Hex | Meaning |
|---|---|---|
| `--primary` (indigo) | `#1e1b4b` | Super Admin surface + Timeline File reference. The "structure" signal. |
| `--primary-soft` | `#ebebf7` | Indigo background — quote callouts, soft pills |
| `--primary-line` | `#c4c2e0` | Indigo border |
| `--accent` (amber) | `#b45309` | JS Priority signal. The "this matters to JS" signal. |
| `--accent-soft` | `#fef3c7` | Amber background — JS Priority badges, deadline warnings |
| `--accent-line` | `#f0c674` | Amber border |

### 1.3 Status colours

Each status colour has a paired "-soft" variant for backgrounds (used in pills, callouts).

| Status | Token | Hex | Soft hex |
|---|---|---|---|
| Urgent / overdue | `--urgent` | `#b91c1c` | `#fee2e2` |
| High priority | `--high` | `#c2410c` | `#ffedd5` |
| Medium priority | `--medium` | `#1e40af` | `#dbeafe` |
| Low priority | `--low` | `#525252` | `#f0f0ec` |
| In progress | `--info` | `#0e7490` | `#cffafe` |
| Awaiting / on hold | `--hold` | `#92400e` | `#fef3c7` |
| Completed / closed | `--success` | `#15803d` | `#dcfce7` |
| Not started / pending | `--pending` | `#525252` | `#f0f0ec` |

### 1.4 Division avatar colours

Each division has a stable avatar colour assigned at creation. Officers and tasks within a division inherit that colour on their avatar / division-tag. Initial assignments:

| Division | Hex |
|---|---|
| Khelo India Division | `#4338ca` (indigo-purple) |
| Khelo India Mission | `#b45309` (amber) |
| Autonomous Bodies | `#047857` (emerald) |
| Sports Goods Manufacturing | `#be185d` (rose) |
| Media and IT | `#1e40af` (blue) |
| Office of JS / OSD | `#1e1b4b` (deep indigo) |

For hierarchy chart (officer slot tones, lightening as slot descends):

| Slot | Hex |
|---|---|
| JS | `#1e1b4b` |
| OSD | `#312e81` |
| Director | `#4338ca` |
| Dy. Secretary | `#5b58d6` |
| Under Secretary | `#4f46e5` |
| Section Officer | `#6366f1` |
| ASO | `#7c7be0` |
| Contract role override | `#b45309` (amber, overrides the slot tone) |

---

## 2. Typography

### 2.1 Fonts

- **Manrope** (300–700) — body text, UI labels, buttons, navigation. Loaded from Google Fonts.
- **Newsreader** (400, 500) — page headings (H1), formal quotes (Secretary's comments), and select large numbers (stat counts, modal titles). Optical sizing range 6–72. Loaded from Google Fonts.
- **JetBrains Mono** (400, 500) — usernames, file reference numbers (TF-YYYY/NNN), system IDs. Loaded from Google Fonts.

### 2.2 Scale (mobile-first)

| Use | Size | Weight | Family |
|---|---|---|---|
| H1 (task title, modal title) | 22–26 px | 500 | Newsreader |
| H2 / large heading | 19–20 px | 500 | Newsreader |
| Body | 13–14 px | 400 | Manrope |
| Strong body | 13–14 px | 500 | Manrope |
| Section header label | 11 px | 500 | Manrope, uppercase, letter-spacing 0.08em |
| Metadata / small | 11–12 px | 400 | Manrope, colour `--ink-3` |
| Pill / badge | 10–11 px | 500 | Manrope, letter-spacing 0.01em |
| Reference number (TF) | 11 px | 500 | JetBrains Mono |
| Username | 12 px | 400 | JetBrains Mono |

### 2.3 Desktop additions (Super Admin)

| Use | Size |
|---|---|
| H1 (page heading) | 24 px |
| H2 / sub-page heading | 20 px |
| Body | 12.5–13 px |
| Subnav | 12.5 px |
| Sidebar item | 12–12.5 px |

### 2.4 Two font weights only

In a single component, use only 400 and 500 — no mid-sentence bolding, no 600/700. Hierarchy is created through size, colour, and family changes (sans → serif for headings), not weight stacking.

---

## 3. Badge & Pill Grammar

### 3.1 The four pill families

1. **Status pills** — colour-coded by status, always paired with a small icon (icon left, label right). Examples: `In progress` with progress icon, `Awaiting input` with clock icon. Status icon mapping below.
2. **Priority pills** — same format as status pills, with priority colours. The priority dot (a coloured 8px circle on a task card) is the compact variant.
3. **JS Priority badge** — amber background, amber border. Reads "JS — today" / "JS — this week" / etc. with a bookmark-filled icon. The most distinctive badge in the system.
4. **Milestone pill** — indigo background, no border. Reads "Milestone" with a flag icon.

### 3.2 Status icon mapping

| Status | Tabler icon name |
|---|---|
| Not started | `ti-circle-dashed` |
| In progress | `ti-progress` |
| Awaiting input | `ti-clock` |
| On hold | `ti-player-pause` |
| Completed | `ti-circle-check` |
| Pending action (TF) | `ti-circle-dashed` |
| Awaiting reply (TF) | `ti-clock` |
| Closed (TF) | `ti-circle-check` |

### 3.3 Priority colour mapping

| Priority | Pill colour | Dot colour |
|---|---|---|
| Urgent | `--urgent` on `--urgent-soft` | `--urgent` |
| High | `--high` on `--high-soft` | `--high` |
| Medium | `--medium` on `--medium-soft` | `--medium` |
| Low | `--low` on `--low-soft` | `--low` |

### 3.4 Contract role mini-badge

When a user has a contract role, a small pill sits above their card (top-right) reading **PO**, **APO**, or **YP**. The slot underneath the name shows the regular hierarchy slot the contract role maps to. The avatar takes the amber contract-tone (`#b45309`) instead of the slot's indigo shade.

### 3.5 Deadline countdown pill (Timeline Files)

Amber pill, format "N days left" (≥ 1 day) or "Today" or "N days overdue" (red variant). Always shown alongside the absolute date in the Details section.

---

## 4. Iconography

- **Tabler Icons** (outline style) from `cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0`.
- Use the outline variants by default; filled variants (`-filled` suffix) only for small accent icons inside pills (e.g. `ti-bookmark-filled` in the JS badge).
- Icon size in pills: 11 px. In buttons: 14–16 px. In section header leading icons: 14–16 px.
- Icons in interactive elements get `aria-hidden="true"` since they're paired with text labels.

---

## 5. Layout & Spacing

### 5.1 Mobile

- Phone viewport: 390 × 820 (iPhone 14 reference).
- Outer screen padding: 20 px horizontal.
- Section vertical padding: 16–18 px.
- Card internal padding: 12–14 px.
- Section dividers: 1 px solid `--line-2`, no extra margin.
- Floating action button (Quick Create "+"): 56 × 56 px, bottom-right, 20 px from edges.
- Sticky comment composer: full width, bottom of screen, 10 px vertical padding.

### 5.2 Desktop (Super Admin only)

- Page max-width: 1280 px.
- Three-column grid: 260 px sidebar + flex centre + 320 px inspector.
- Outer padding: 24 px.
- Centre content padding: 20 px vertical, 28 px horizontal.
- Subnav height: ~44 px.
- Top bar height: ~58 px.

### 5.3 Touch targets

- Minimum tap target on mobile: 44 × 44 px (chevrons inside detail rows count the full row, not just the chevron).
- Detail rows: 11 px vertical padding ensures ~44 px total height.

---

## 6. Components

### 6.1 Task card (list view)

- Border: 1 px `--line`, radius 12 px.
- Top row: task name (14 px / 500) on the left, priority dot (8 px) on the right.
- Meta row: division name, separator dots.
- Bottom row: status pill + JS Priority badge + Milestone pill on the left; subtask progress chip + due date + owner avatar on the right.
- **JS Priority variant:** gradient background (warm cream `#fffdf7` → white) and a 3 px amber left-stripe positioned at top 14 / bottom 14.

### 6.2 Officer card (hierarchy chart)

- 168–200 px wide, ~52 px tall.
- Avatar (28 px) + Name + Slot in two lines.
- Contract mini-badge floats above top-right corner.
- Selected state: indigo border + 3 px `--primary-soft` ring (`box-shadow: 0 0 0 3px var(--primary-soft)`).

### 6.3 Bottom sheet (mobile)

- Slides up from bottom, rounded corners 24 px top.
- Drag handle: 36 × 4 px, colour `--line`, centred.
- Title: 20 px Newsreader.
- Backdrop: `rgba(0,0,0,0.4)`.

### 6.4 Quote callout (Secretary's comments)

- White panel, 1 px `--primary-line` border, 4 px indigo left border, rounded `0 12px 12px 0`.
- Body in Newsreader 14 px.
- Faint "quotation mark" in Newsreader 32 px, top-right, colour `--primary-line`.
- Signature line with a small hyphen rule before the name.

### 6.5 Inline status-update card (inside a comment)

- Sits below the comment body, indented to align with the comment text.
- Soft cyan background (`--info-soft`), 3 px solid `--info` left border, rounded 8 px.
- Format: `[icon] Status: [new status label]`.

### 6.6 Action document placeholder (Timeline File)

- Dashed border, 1.5 px, rounded 12 px, `--bg` background.
- Large cloud-upload icon (26 px), label, sub-label.
- On hover: border becomes indigo, background becomes `--primary-soft`.

### 6.7 Switch (toggle)

- 36 × 20 px track, 16 × 16 px knob.
- Off: track `--line`. On: track `--ink`.
- Smooth 0.2 s transition.

### 6.8 Modal (desktop)

- Centred, 460 px wide, rounded 14 px.
- Backdrop: `rgba(0,0,0,0.4)`.
- Title: Newsreader 22 px.
- Form spacing: 14 px between fields.

---

## 7. Interaction Patterns

### 7.1 Drag-and-drop

Used in three places:

1. **JS Priority Board** — drag tasks between Today / This Week / This Month / Watchlist lanes (and reorder within a lane).
2. **Super Admin hierarchy mapper** — drag officer cards within and across supervisor groups; drag in/out of the Unassigned pool.
3. **Super Admin structure tree** — restructure divisions / sub-divisions (future enhancement, not in v1).

All drag-and-drop uses **Sortable.js** with a shared group, dashed-amber ghost while dragging, and a faint drop-target tint on all valid destinations.

### 7.2 Quick Create

- Single floating "+" button, available on every mobile screen.
- One field on open: task name (auto-focused).
- "Add more details" toggle expands the rest inline.
- Save without expanding = task created with defaults.

### 7.3 @mention

- Type `@` in any comment composer to summon the mention picker.
- Tap @ button on the composer for the same.
- Selecting a name inserts `@Name ` (with trailing space) and closes the picker.
- @mentions render in the rendered comment as soft-indigo chips.
- Mentioned users receive a notification on send.

### 7.4 Status update via @mention

The canonical request-for-status flow:

1. User A asks: comment with `@User B can you give an update?`
2. User B replies in the same thread.
3. If User B's reply involves a status change, the inline status-update card appears below the comment automatically.

There is no separate "Request status" button — the @mention is the request, the reply is the answer.

### 7.5 Attachment preview

- Tapping an attachment opens a full-screen preview overlay.
- Top bar: black with file name + size + close + more.
- Body: scrollable mock-document page (for PDFs) or external-app prompt (for Drive links).
- Bottom action strip: Download / Share / Comment / Versions (each 11 px label, icon stacked).

### 7.6 Role switcher (top bar)

- Two-button segmented control in the top-right.
- Active button: `--ink` background, white text.
- Inactive: transparent, hover `--line-2`.
- Single click flips between Super Admin and Command Centre.

---

## 8. Copy & Voice

- **Sentence case** for everything — labels, headings, buttons, navigation, notifications. No "Joint Secretary" in body copy when "JS" is fine; no ALL CAPS labels except section headers (which use uppercase via CSS).
- **Concise toast messages** — past tense or imperative ("Task created", "Priority updated to High"). Never "Successfully...".
- **No exclamation marks** in system copy.
- **No emojis** in the UI (icons via Tabler are sufficient).
- **Government register but not formal-stiff.** "Your superior" not "the appropriate authority". "Drop here" not "Place in this container".
- **Numbers**: spell out one through nine in body copy; use numerals from 10 onwards.

### 8.1 Specific micro-copy decisions

| Where | Copy |
|---|---|
| Quick Create placeholder | `Task name…` |
| Comment composer placeholder | `Add a comment or ask for an update… use @ to mention` |
| Empty priority lane | `Drop tasks here` |
| Empty linked-tasks panel | `No tasks linked yet — Create task from this file` |
| Action document placeholder | `Upload action document` / `The final response sent in reply to this file — uploaded by the concerned section when action is complete` |
| Reassign — sideways/upward | `Approval needed` badge in amber on the picker row |
| Drag hint on Priority Board | `Drag any task between lanes to set JS priority` |
| Drag hint on hierarchy chart | `Drag any officer card to reorder within their level, or drop into a different supervisor's group` |

---

## 9. Accessibility Floor

- WCAG AA contrast on all text. Section headers use `--ink-2` (4.5:1 against panel) not `--ink-3`.
- **Semantic HTML**: `<main>`, `<section>`, `<header>`, `<article>`, `<h1>`–`<h2>`, `<button>`, `<time>` — no clickable `<div>`s.
- **aria-labelledby** linking section to heading.
- **aria-expanded** on Read more / Show older toggles.
- **aria-checked** + Space/Enter keyboard support on custom checkboxes (subtasks).
- **aria-label** on every icon-only button (back arrow, more menu, send, attach, @mention button).
- **Focus rings**: 2 px solid `--primary` outline, 2 px offset, visible only on keyboard navigation (`:focus-visible`).
- **Tap targets** ≥ 44 × 44 px.
- **Colour is never the only signal** — every status colour is paired with an icon or text label.

---

## 10. Component Library Suggestion (for build)

When implementing in Lovable (React + Tailwind), define these as primary components:

- `<Pill variant="status|priority|js|milestone" tone="...">` with icon + label
- `<OfficerCard slot="..." selected?>` for the hierarchy chart
- `<TaskCard jsPriority? milestone? subtasks?>` for list views
- `<TimelineFileCard variant="full|compact">`
- `<BottomSheet>` with drag handle
- `<Modal>` for desktop dialogs
- `<DetailRow icon label value chevron?>`
- `<SecretaryQuote body signature>`
- `<InlineStatusUpdate status>` (inside comments)
- `<ActionDocumentPlaceholder>` and `<ActionDocument file>`
- `<MentionChip name>`
- `<DivisionTreeNode>`
- `<Switch on?>`

Each should accept the colour tokens via CSS variables so theming stays consistent.

---

*End of Design Tokens & Patterns*
