# Document Centre

An executive-only workspace for confidential records — minutes (MoMs), meeting
documents, briefing notes, reports, presentations, and official correspondence.
Built as a native extension of the Tasks module: it reuses the same design
system, attachment pipeline, discussion component, notification/audit
subsystems, and server-action contract.

## Access model

Two **orthogonal** rules — this is the key to the design:

1. **Document Centre access** is an explicit **username allowlist**, not a
   division rule. Visible only to Super Admins and the three OSD desks
   (`osd.myas`, `osd.ss`, `osd.dgsai`). The allowlist lives in
   [`src/lib/document-centre-shared.ts`](../src/lib/document-centre-shared.ts)
   (`DOCUMENT_CENTRE_USERNAMES` / `canAccessDocumentCentre`), mirroring the
   existing `showTourReport` username gate. All four authorized users see
   **every** record — it is a shared confidential workspace.

2. **HMAYS division isolation** is separate and needs **no visibility-engine
   change**. `osd.ss` and `osd.dgsai` are provisioned as ordinary
   HMAYS-division heads (not Super Admin, not the `osd` slot), so the existing
   ministry-officer visibility rules already scope them to HMAYS data across
   Tasks, Timeline Files, Calendar, Priority Board, and Search. Super Admins
   are unaffected (they see everything).

Because Document Centre records are gated by the allowlist rather than the
division-scoped visibility engine, HMAYS isolation and the shared workspace do
not conflict.

### Enforcement (defence in depth)

| Layer | Where |
|---|---|
| Sidebar / mobile nav | `canAccessDocumentCentre` flag threaded from `(app)/layout.tsx` → `AppShell` → `Sidebar` / `MobileNavDrawer` / `MobileBottomNav` (item hidden otherwise) |
| Page routes | `document-centre/page.tsx` + `[id]/page.tsx` gate with `canAccessDocumentCentre`, else `redirect('/tasks')` |
| Search API | `/api/documents/search` → `401` unauthenticated, **`403`** if not allowlisted |
| Upload API | `/api/attachments/upload-url` → `403` for the `document` scope unless allowlisted |
| Server actions | every action in `documents.ts` re-checks `canAccessDocumentCentreById` and returns a not-authorized state |
| DB queries | `fetchVisibleDocuments` / `fetchDocumentCounts` / `quickSearchDocuments` return empty for a non-allowlisted caller |

`/api` is **not** covered by the app middleware for authorization (see the
`/api/tasks/search` header comment), so each handler re-checks — same as the
rest of the codebase.

## Data model

- `DocumentRecord` — `subject`, `context` (free text, the Task-`description`
  analogue), `urgency` (`highly_urgent` / `urgent` / `normal`), `status`
  (`open` / `completed`), `markedForReview`, `awaitingInput`, plus
  `lastActivityAt` for the "Recently modified" sort. Mirrors the Task shape.
- `DocumentComment` — threaded discussion, identical to `TimelineFileComment`.
- **Attachments + Google Drive links** reuse the polymorphic `Attachment`
  table with the new `document_record` owner type — no join table. Drive links
  are `Attachment` rows with `source = 'drive_link'`, exactly as for tasks.

## Feature map (all reuse existing infrastructure)

- **Urgency** replaces task priority — rendered with the existing `Pill`
  `priority` variant, mapped to tones (Highly urgent → red, Urgent → orange,
  Normal → muted). No new Pill code.
- **Workflow** — "Mark for review" → *Under review* badge; "Awaited input" →
  *Awaiting input* badge; plus a completion toggle behind the *Completed*
  filter.
- **Record card** — subject, urgency, workflow badges, created-by + date, and
  an attachment clip.
- **Search** across subject, context, attachment names, discussion, and Drive
  links (`quickSearchDocuments`), gated + scoped like the tasks quick search.
- **Sort** — Recently modified / Latest created / A–Z.
- **Filters** — All / Under review / Awaiting input / Highly urgent /
  Completed.
- **Discussion** — the shared `<Discussion>` component. Mentions are restricted
  to the four executives in **both** the picker query and the resolver
  (`documentMentionWhere`).
- **Notifications** — new `NotificationType` values (record created, discussion,
  review requested/completed, awaiting input, attachment/drive-link added);
  `mention` is reused with a `documentId` payload branch. Fanned out to the
  executive audience via inline `prisma.notification.createMany` (the codebase's
  per-action idiom), rendered by `describeNotification`.
- **Audit** — the global immutable `AuditLog` with `entityType:
  'document_record'` (free-text, no migration). Create / update / delete plus
  descriptive `before`/`after` for review, workflow, attachment, and drive-link
  changes. Appears on `/admin/audit` automatically.

## Provisioning HMAYS + the OSD desk accounts

`osd.ss` / `osd.dgsai` and the HMAYS division are created by an **idempotent,
non-destructive** script (the main `seed.ts` wipes data, so it is not used for
production provisioning):

```bash
SEED_DEFAULT_PASSWORD='<temp password>' pnpm db:seed:document-centre
```

Both accounts get `forcePasswordChange=true`. Run it once, after applying the
migrations (`pnpm db:migrate:deploy`). Re-running is safe.

## Migrations

Two hand-authored SQL migrations (repo convention):

- `20260713120000_document_centre_enums` — `ALTER TYPE` additions
  (`AttachmentOwnerType += document_record`, the seven notification types).
  Kept separate so the new enum values are committed before anything uses them.
- `20260713120100_document_centre_tables` — the two new enums + the
  `document_records` / `document_comments` tables, indexes, and FKs.
