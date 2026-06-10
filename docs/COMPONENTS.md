# Component Catalogue

> Every component listed in Design Tokens §10, mapped to a file path, a props interface, variants, the CSS tokens it consumes, and any mobile/desktop differences. Derived from the four HTML prototypes.

All components are React + Tailwind in Next.js 14 App Router. Token names refer to CSS custom properties defined in [COLOUR_TOKENS.css](COLOUR_TOKENS.css).

---

## Index

1. [Pill](#1-pill)
2. [OfficerCard](#2-officercard)
3. [TaskCard](#3-taskcard)
4. [TimelineFileCard](#4-timelinefilecard)
5. [BottomSheet](#5-bottomsheet)
6. [Modal](#6-modal)
7. [DetailRow](#7-detailrow)
8. [SecretaryQuote](#8-secretaryquote)
9. [InlineStatusUpdate](#9-inlinestatusupdate)
10. [ActionDocumentPlaceholder + ActionDocument](#10-actiondocumentplaceholder--actiondocument)
11. [MentionChip](#11-mentionchip)
12. [DivisionTreeNode](#12-divisiontreenode)
13. [Switch](#13-switch)

Supporting components added for completeness:

14. [Badge / contract mini-badge](#14-badge--contract-mini-badge)
15. [Avatar (owner / division-coloured)](#15-avatar-owner--division-coloured)
16. [FloatingActionButton](#16-floatingactionbutton)
17. [TopBar (mobile + desktop)](#17-topbar-mobile--desktop)
18. [BottomNav (mobile)](#18-bottomnav-mobile)
19. [RoleSwitcher (top-bar segmented control)](#19-roleswitcher-top-bar-segmented-control)
20. [SubNav (Super Admin)](#20-subnav-super-admin)

---

## 1. Pill

The universal compact label — status, priority, JS Priority, milestone.

- **File:** `src/components/ui/Pill.tsx`
- **Used in:** task cards, task detail title block, Timeline File title block, linked-task chips, comment status-update inline (variant), inspector pill-mini.

```ts
type PillVariant = 'status' | 'priority' | 'js' | 'milestone' | 'deadline';

type PillStatusTone =
  | 'not_started' | 'in_progress' | 'awaiting_input'
  | 'on_hold' | 'completed'
  | 'pending_action' | 'awaiting_reply' | 'closed';        // TF-specific tones

type PillPriorityTone = 'low' | 'medium' | 'high' | 'urgent';
type PillJsLane       = 'today' | 'week' | 'month' | 'watchlist';

type PillProps =
  | { variant: 'status';    tone: PillStatusTone;   label: string }
  | { variant: 'priority';  tone: PillPriorityTone; label: string }
  | { variant: 'js';        lane: PillJsLane }                 // label derived: "JS — today" etc.
  | { variant: 'milestone' }
  | { variant: 'deadline';  daysLeft: number; overdue?: boolean };
```

**Variants** (the only legal combinations):

| Variant | Tones | Example |
|---|---|---|
| `status` | `not_started`, `in_progress`, `awaiting_input`, `on_hold`, `completed` (tasks); `pending_action`, `in_progress`, `awaiting_reply`, `on_hold`, `closed` (Timeline Files) | "In progress" + `ti-progress` |
| `priority` | `low`, `medium`, `high`, `urgent` | "Urgent" + `ti-flame` |
| `js` | `today`, `week`, `month`, `watchlist` | "JS — today" + `ti-bookmark-filled` |
| `milestone` | (no tone) | "Milestone" + `ti-flag-3` |
| `deadline` | (no tone; `daysLeft` and `overdue` drive label and colour) | "2 days left" or "1 day overdue" + `ti-clock` |

**Tokens consumed:**
- Status `in_progress` → `--info`, `--info-soft`
- Status `awaiting_input` / `on_hold` → `--hold`, `--hold-soft`
- Status `completed` / `closed` → `--success`, `--success-soft`
- Status `not_started` / `pending_action` → `--pending`, `--pending-soft` (= `--low`/`--low-soft`)
- Priority tones → `--urgent`, `--high`, `--medium`, `--low` (each with `-soft`)
- JS → `--accent`, `--accent-soft`, `--accent-line`
- Milestone → `--primary`, `--primary-soft`
- Deadline (≥ 1 day) → `--accent`, `--accent-soft`, `--accent-line`
- Deadline (overdue) → `--urgent`, `--urgent-soft`, border `rgba(185,28,28,0.3)`

**Rules:**
- Every pill carries a Tabler icon (left of label). Colour is never the only signal.
- Icon: 11 px, `aria-hidden="true"`.
- Pill: 10 px, weight 500, letter-spacing 0.01em, radius 11 px, padding 4 × 9 px.
- Status icon mapping (mandatory):

| Status | Icon |
|---|---|
| `not_started` | `ti-circle-dashed` |
| `in_progress` | `ti-progress` |
| `awaiting_input` | `ti-clock` |
| `on_hold` | `ti-player-pause` |
| `completed` | `ti-circle-check` |
| `pending_action` (TF) | `ti-circle-dashed` |
| `awaiting_reply` (TF) | `ti-clock` |
| `closed` (TF) | `ti-circle-check` |

**Mobile vs desktop:** identical.

---

## 2. OfficerCard

Card for the Super Admin hierarchy chart and the Unassigned pool.

- **File:** `src/components/admin/OfficerCard.tsx`
- **Used in:** Super Admin → Structure & hierarchy.

```ts
type OfficerCardProps = {
  slot: 'js' | 'osd' | 'director' | 'deputy_secretary' | 'under_secretary' | 'section_officer' | 'aso';
  contractRole?: 'po' | 'apo' | 'yp';
  name: string;            // "Sneha T."
  designation: string;     // shown below the name; "Section Officer (YP)" etc.
  initials: string;        // "ST" — avatar text
  selected?: boolean;
  draggable?: boolean;
  onSelect?: () => void;
};
```

**Variants:**
- **Default** — 1 px `--line` border, white panel.
- **Selected** — `--primary` border + 3 px `--primary-soft` ring (`box-shadow: 0 0 0 3px var(--primary-soft)`).
- **Dragging ghost (Sortable.js)** — opacity 0.4, dashed indigo border, `--primary-soft` background.
- **Contract role override** — avatar background switches to `--slot-contract` (amber); contract mini-badge floats above top-right.

**Tokens consumed:**
- `--panel`, `--line`, `--ink`, `--ink-3`
- Selected: `--primary`, `--primary-soft`
- Avatar tone by slot: `--slot-js`, `--slot-osd`, `--slot-director`, `--slot-deputy-secretary`, `--slot-under-secretary`, `--slot-section-officer`, `--slot-aso`
- Contract: `--slot-contract`, `--accent`

**Dimensions:**
- 168–200 px wide, ~52 px tall.
- Avatar 28 px, font 10 px / 500.
- Name 12.5 px / 500; slot 10 px / `--ink-3`.

**Mobile vs desktop:** desktop-only component (Super Admin Console). No mobile variant.

---

## 3. TaskCard

The card on every task list, plus the lane variant inside the JS Priority Board.

- **File:** `src/components/ui/TaskCard.tsx`
- **Used in:** mobile task list, JS Priority Board lanes, linked-tasks panel inside a Timeline File.

```ts
type TaskCardProps = {
  taskId: string;
  name: string;
  division: { name: string; avatarKey: DivisionAvatarKey };
  status: PillStatusTone;
  statusLabel: string;
  priority: PillPriorityTone;
  jsPriorityLane?: PillJsLane | null;
  milestone?: boolean;
  due?: { label: string; tone: 'today' | 'overdue' | 'soon' | 'future' };
  owner: { initials: string; avatarKey: DivisionAvatarKey };
  subtasks?: { done: number; total: number };
  variant?: 'list' | 'lane';   // 'lane' adds drag handle, compact spacing
  onOpen?: () => void;
};

type DivisionAvatarKey =
  | 'khi' | 'km' | 'ab' | 'sgm' | 'mit' | 'osd';
```

**Variants:**
- **`list`** (default) — full task card on the main task list.
- **`lane`** — inside a JS Priority Board lane: 13 px font, drag handle (`ti-grip-vertical`) prepended, fewer pills.
- **`js-priority`** modifier (applied when `jsPriorityLane` is truthy) — gradient background `linear-gradient(180deg, #fffdf7 0%, #ffffff 100%)`, `--accent-line` border, and a 3 px amber left-stripe (top 14 / bottom 14).
- **`completed`** modifier (visual only — in linked-tasks panel) — opacity 0.65; name struck through.

**Tokens consumed:**
- `--panel`, `--line`, `--ink`, `--ink-3`
- JS variant: `--accent`, `--accent-line`, and the gradient hex (kept as a literal because it's a token-defined cream)
- Owner avatar: division-coloured (`--division-*`)
- Subtask progress chip background: `--line-2`; text `--ink-3`.

**Rules:**
- Top row: task name left, `priority-dot` (8 px circle) right.
- Meta row: division name only (separator dots if extra meta).
- Bottom row: status pill + JS Priority pill + Milestone pill on the left; subtask progress chip + due date + owner avatar on the right.

**Mobile vs desktop:** identical — the JS Priority Board itself is mobile-first; lane width is 270 px regardless of viewport.

---

## 4. TimelineFileCard

Linked-Timeline-File card on the task detail screen + the row on the Timeline Files master list.

- **File:** `src/components/ui/TimelineFileCard.tsx`
- **Used in:** task detail (Linked timeline file section), Timeline Files master view, OSD Command Centre.

```ts
type TimelineFileCardProps = {
  refNo: string;                       // "TF-2026/34"
  subject: string;                     // shown only in 'full'
  fromWhom: string;
  receivedDate: string;                // ISO or formatted
  markedToDivisions: string[];
  deadline?: { label: string; daysLeft: number; overdue?: boolean };
  status?: PillStatusTone;             // 'pending_action' | 'in_progress' | …
  variant: 'full' | 'compact';
  onOpen?: () => void;
};
```

**Variants:**
- **`compact`** — used inside the task detail screen. Icon tile (`ti-file-stack`) + title (ref-no + short subject) + sub-line ("From X, received Y. Marked to Z") + amber deadline line.
- **`full`** — used on the Timeline Files master list. Larger; includes status pill.

**Tokens consumed:**
- `--primary-soft` background, `border: 1px solid rgba(30,27,75,0.1)`
- Icon tile: `--primary` background, white icon
- Title text: `--primary`
- Sub line: `--ink-2`
- Deadline line: `--accent`, weight 500
- Hover: `transform: translateY(-1px); box-shadow: 0 2px 6px rgba(30,27,75,0.08)`

**Mobile vs desktop:** identical visually; the master-view list adapts to a 2-column grid on desktop.

---

## 5. BottomSheet

Mobile-only sliding sheet. Quick Create, picker sheets, "Create task from this file", status picker.

- **File:** `src/components/ui/BottomSheet.tsx`

```ts
type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;          // Newsreader 20 px
  subtitle?: string;       // optional second line
  children: React.ReactNode;
};
```

**Tokens consumed:**
- `--panel` panel; backdrop `rgba(0,0,0,0.4)`
- Drag handle 36 × 4 px, `--line`
- Title: Newsreader 20 px / 500
- Subtitle: 12 px / `--ink-3`

**Rules:**
- Rounded 24 px top corners; padding `12px 20px 24px`.
- Slides up with transform translateY transition `0.25s cubic-bezier(0.32, 0.72, 0, 1)`.
- Backdrop click closes; provides focus trap for nested controls.
- Max height 80–85% of phone viewport; internal scroll.

**Mobile vs desktop:** mobile only. On desktop, use `Modal` instead.

---

## 6. Modal

Desktop-only centred dialog. Add user, reset password, edit details.

- **File:** `src/components/ui/Modal.tsx`

```ts
type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;            // Newsreader 22 px
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode; // typically right-aligned button group
};
```

**Tokens consumed:**
- `--panel` panel; backdrop `rgba(0,0,0,0.4)`
- Border-radius 14 px; width 460 px (max-width 90 vw); shadow `0 20px 50px -10px rgba(0,0,0,0.25)`
- Title `--ink`; sub-title `--ink-3`

**Form spacing inside modals:** 14 px between fields. Form labels: 11 px / 500 / `--ink-2`. Inputs: 1 px `--line` border, radius 8 px, padding 9 × 12 px, focus border `--ink`.

**Mobile vs desktop:** desktop only.

---

## 7. DetailRow

Tappable row used on task detail and Timeline File detail.

- **File:** `src/components/ui/DetailRow.tsx`

```ts
type DetailRowProps = {
  icon: TablerIconName;
  label: string;          // "Owner", "Due", "Division" …
  value: React.ReactNode; // text, avatar+name, tag chips, etc.
  chevron?: boolean;      // default true on editable rows
  alert?: boolean;        // alerts colour 'value' as --accent
  onClick?: () => void;
  ariaLabel?: string;
};
```

**Tokens consumed:**
- Icon: 16 px, `--ink-3`
- Key: 13 px, `--ink-2`, fixed-width 90–100 px
- Value: 13 px / 500, right-aligned
- Hover background: `--bg`
- Alert value: `--accent`

**Rules:**
- Total height ≥ 44 px (11 px vertical padding inside).
- Whole row is tappable; the chevron is decorative.
- Render as a `<button>` semantic element; do not wrap in another button.

**Mobile vs desktop:** identical; desktop variant just has a hover background.

---

## 8. SecretaryQuote

Serif-quoted callout for Timeline File Secretary's comments.

- **File:** `src/components/timeline/SecretaryQuote.tsx`

```ts
type SecretaryQuoteProps = {
  body: string;                  // free text; Newsreader 14 px
  signature: string;             // "Secretary, Sports · 18 May"
};
```

**Tokens consumed:**
- `--panel` background, `--primary-line` border, `--primary` 4-px left border
- Border-radius `0 12px 12px 0`
- Body font: Newsreader 14 px, line-height 1.55, `--ink`
- Quote mark glyph (top-right, decorative): Newsreader 32 px, `--primary-line`
- Signature: 11 px / 500, `--primary`; preceded by a 18 × 1 px `--primary-line` hyphen rule

**Mobile vs desktop:** identical.

---

## 9. InlineStatusUpdate

Cyan callout inside a comment when a status change accompanied it.

- **File:** `src/components/task/InlineStatusUpdate.tsx`

```ts
type InlineStatusUpdateProps = {
  status: PillStatusTone;
  label: string;        // "In progress", "Completed" …
};
```

**Tokens consumed:**
- `--info-soft` background, 3 px solid `--info` left border, radius 8 px
- Icon (from the status icon mapping in Pill §1) + "Status: [label]" text in `--info`

**Mobile vs desktop:** identical.

---

## 10. ActionDocumentPlaceholder + ActionDocument

Two states for the Timeline File action document slot.

- **Files:**
  - `src/components/timeline/ActionDocument.tsx` (handles both states internally based on `file` prop)
  - exported placeholder via `<ActionDocument file={null} />`

```ts
type ActionDocumentProps = {
  file: { name: string; mimeType: string; sizeBytes: number; url: string } | null;
  onUpload?: () => void;
  onOpen?: () => void;
};
```

**Placeholder (when `file` is null):**
- Dashed 1.5 px `--line` border, radius 12 px, padding 22 × 16 px
- `--bg` background; centred content
- Cloud-upload icon `ti-cloud-upload` (26 px, `--ink-3`)
- Label "Upload action document" (13 px / 500 / `--ink-2`)
- Sub-label "The final response sent in reply to this file — uploaded by the concerned section when action is complete"
- Hover: border `--primary`, background `--primary-soft`

**Uploaded state:**
- Standard `attach` row (see Attachments pattern in prototype): file icon + name + uploaded-by + size

**Tokens consumed:** `--line`, `--bg`, `--ink-2`, `--ink-3`, `--primary`, `--primary-soft`.

**Mobile vs desktop:** identical.

---

## 11. MentionChip

Inline indigo chip rendered inside comment bodies for `@Name` mentions.

- **File:** `src/components/ui/MentionChip.tsx`

```ts
type MentionChipProps = {
  userId: string;
  name: string;
  onClick?: () => void;
};
```

**Tokens consumed:**
- `--primary-soft` background, `--primary` text, padding 1 × 5 px, radius 4 px, font 12.5 px / 500

**Mobile vs desktop:** identical.

---

## 12. DivisionTreeNode

Row in the Super Admin sidebar tree.

- **File:** `src/components/admin/DivisionTreeNode.tsx`

```ts
type DivisionTreeNodeProps = {
  name: string;
  kind: 'division' | 'sub_division' | 'section' | 'pmu';
  count?: number;          // people count, rendered as the right-aligned chip
  expanded?: boolean;      // controls caret rotation
  active?: boolean;        // selected state (indigo background)
  depth?: number;          // controls left padding/border
  onToggle?: () => void;
  onSelect?: () => void;
  children?: React.ReactNode;  // nested DivisionTreeNodes
};
```

**Variants:**
- **`division`** (top-level) — `ti-building` icon, caret on the left
- **`sub_division`** — `ti-point-filled` (8 px) icon
- **`section`** — `ti-circle-dot` icon
- **`pmu`** — `ti-building-bridge` icon
- **`active`** — `--primary-soft` background, `--primary-line` border, `--primary` text

**Tokens consumed:**
- Default: `--ink`, hover `--bg`
- Active: `--primary-soft`, `--primary-line`, `--primary`
- Count chip: `--line-2` background, `--ink-3` text (default); `--panel` background, `--primary` text (active)
- Nested children: left border 1 px `--line`, indented 10 px

**Mobile vs desktop:** desktop-only.

---

## 13. Switch

Toggle for milestone / recurring / Super Admin access / personal-visibility.

- **File:** `src/components/ui/Switch.tsx`

```ts
type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
};
```

**Dimensions:**
- Track 36 × 20 px, radius 10 px.
- Knob 16 × 16 px, white, radius 50%, `box-shadow: 0 1px 2px rgba(0,0,0,0.2)`.
- Transition 0.2 s.

**Tokens consumed:**
- Off: track `--line`
- On: track `--ink`

**Mobile vs desktop:** identical.

---

## 14. Badge / contract mini-badge

Small uppercase chip floating above an officer card.

- **File:** `src/components/ui/Badge.tsx`

```ts
type BadgeProps = {
  variant: 'contract' | 'pmu' | 'role';
  label: string;             // "PO", "APO", "YP"
};
```

**Tokens consumed:**
- Contract: `--accent` background, white text
- PMU: `--success` background, white text
- Role: `--info` background, white text
- Font 8.5 px / 500, uppercase, letter-spacing 0.02 em, padding 2 × 6 px, radius 8 px

**Mobile vs desktop:** identical.

---

## 15. Avatar (owner / division-coloured)

Circular initials avatar.

- **File:** `src/components/ui/Avatar.tsx`

```ts
type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';   // 22 / 26 / 32 / 48
type AvatarTone =
  | 'khi' | 'km' | 'ab' | 'sgm' | 'mit' | 'osd'    // division keys
  | 'js' | 'osd_slot' | 'director' | 'deputy_secretary'
  | 'under_secretary' | 'section_officer' | 'aso'
  | 'contract' | 'ink';                              // slot keys + neutral

type AvatarProps = {
  initials: string;
  tone: AvatarTone;
  size?: AvatarSize;
  ariaLabel?: string;
};
```

**Tokens consumed:** all `--division-*` and `--slot-*` plus `--ink` for the default fallback.

**Mobile vs desktop:** identical.

---

## 16. FloatingActionButton

Quick Create "+" button on every mobile screen.

- **File:** `src/components/layout/FloatingActionButton.tsx`

```ts
type FabProps = {
  icon?: TablerIconName;     // default 'ti-plus'
  ariaLabel: string;
  onClick: () => void;
};
```

**Tokens consumed:** `--ink` background, white icon, `box-shadow: 0 10px 20px -5px rgba(0,0,0,0.3), 0 4px 8px -2px rgba(0,0,0,0.15)`.

**Dimensions:** 56 × 56 px, radius 50%, bottom-right, 20 px from edges.

**Mobile vs desktop:** mobile only.

---

## 17. TopBar (mobile + desktop)

Header strip — different on mobile and desktop.

- **Files:**
  - `src/components/layout/TopBar.tsx` (responsive — branches by viewport)

**Mobile structure:**
- Brand title (Newsreader 22 px) + uppercase sub-line "Ministry of Y. A. & Sports"
- Action group: search icon-button, notifications bell with amber dot indicator, avatar
- Below it (when applicable): role bar (`--primary-soft` background, role label + select dropdown)

**Desktop structure (Super Admin):**
- Brand + sub-brand text
- Search input (240 px) with embedded search-icon SVG background
- Role switcher segmented control (Super Admin / Command Centre)
- Avatar (30 px)

**Tokens consumed:**
- Mobile role bar: `--primary-soft` background, `--primary` text
- Desktop top bar: `--panel` background, `--line` divider below
- Role switcher (desktop): `--bg` background, `--line` border, active button `--ink`/white

---

## 18. BottomNav (mobile)

(Phase 2.) Persistent bottom navigation on mobile.

- **File:** `src/components/layout/BottomNav.tsx`

Not in the prototypes — design forthcoming. Reserve as a placeholder; document expected items: Tasks, Timeline Files, Priority Board, Calendar, Profile. Use `--panel` background, `--line` top border, icons via Tabler outline 22 px, label 10 px / 500.

**Mobile only.**

---

## 19. RoleSwitcher (top-bar segmented control)

Two-button segmented control for Super Admin ↔ Command Centre.

- **File:** `src/components/layout/RoleSwitcher.tsx`

```ts
type RoleSwitcherProps = {
  value: 'super_admin' | 'command_centre';
  onChange: (next: 'super_admin' | 'command_centre') => void;
};
```

**Tokens consumed:**
- Container: `--bg` background, `--line` border, padding 3 px, radius 8 px
- Active button: `--ink` background, white text
- Inactive button: transparent, hover `--line-2`

**Mobile vs desktop:** desktop-only (visible inside the Super Admin Console top bar). On mobile, role swapping happens via the role bar dropdown on the home screen.

---

## 20. SubNav (Super Admin)

Tab strip for the six Super Admin sub-sections.

- **File:** `src/components/admin/SubNav.tsx`

```ts
type SubNavItem = {
  key: 'structure' | 'users' | 'tags' | 'audit' | 'import' | 'settings';
  icon: TablerIconName;
  label: string;
};

type SubNavProps = {
  items: SubNavItem[];
  active: SubNavItem['key'];
  onSelect: (key: SubNavItem['key']) => void;
};
```

**Tokens consumed:**
- Default: `--ink-2`, hover `--ink`
- Active: `--ink` text, 2 px `--ink` bottom border
- Container: `--panel` background, `--line` bottom border

**Desktop-only.**

---

## Token-usage rules (summary)

- Every component above consumes tokens from [COLOUR_TOKENS.css](COLOUR_TOKENS.css). No hard-coded hex values except the two cream-gradient stops on the JS-priority TaskCard (`#fffdf7 → #ffffff`), which are intentional design tokens not yet promoted to CSS variables — keep them as the only literal exception and consider promoting them later.
- Every interactive element exposes `:focus-visible` with a 2 px solid `--primary` outline, 2 px offset.
- Every icon paired with text gets `aria-hidden="true"`; every icon-only button gets a real `aria-label`.
