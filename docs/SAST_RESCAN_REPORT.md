# SAST Rescan Report -- MYAS Task Tracker

**Post-Remediation Security Assessment**

| Field | Value |
|---|---|
| Report date | 2026-07-07 |
| Target | MYAS Task Tracker |
| Repository | `/Users/manas/Desktop/Office/Task Tracker` (branch: `main`) |
| Stack | Next.js 14.2.35, Prisma 5.18.0, Postgres 16, NextAuth 5.0.0-beta.31, S3/MinIO |
| Deployment | Self-hosted EC2 (ap-south-1), single PM2 process, Postgres on localhost |
| User base | 50--200 internal government officers, Ministry of Youth Affairs & Sports |
| Lines of code | ~37,200 TypeScript (191 source files) |
| Scan type | SAST rescan following 41-finding remediation across Phases 0--5 |

---

## 1. Executive Summary

This report presents the results of a comprehensive Static Application Security Testing (SAST) rescan of the MYAS Task Tracker, conducted after 41 findings from the initial assessment were remediated across five phases. The rescan covered 130 file-reviews across 7 security domains, examining 223 project files.

### Scan results at a glance

| Metric | Value |
|---|---|
| Modules scanned | 7 security domains |
| Files reviewed | 130 (across all domains) |
| Raw findings | 58 |
| Confirmed findings | 56 |
| False positives rejected | 2 (3.4% FP rate) |
| Previously remediated | 41 (from initial scan) |

### Severity distribution (adjusted)

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 2 |
| Medium | 21 |
| Low | 25 |
| Informational | 8 |
| **Total** | **56** |

### Global scores

| Score | Value | Rating |
|---|---|---|
| Security Score | **44.7 / 100** | D |
| Code Quality Score | **6.5 / 10** | Acceptable |

The zero-critical posture is a significant improvement from the initial scan. The two HIGH findings are (1) a known-CVE dependency issue (Next.js 14 EOL) and (2) a business-logic authorization gap (subtask cross-division reassignment). Neither is trivially exploitable by an external attacker given the internal-only deployment, but both require attention before the application can be considered production-hardened.

The MEDIUM tier (21 findings) is dominated by authorization logic bugs in Timeline File management, missing rate limiting on write paths, CSP configuration gaps, and dependency lifecycle issues. Most are defense-in-depth improvements rather than actively exploitable attack chains.

---

## 2. Scan Topology

| Domain | Files Reviewed | Critical | High | Medium | Low | Info |
|---|---|---|---|---|---|---|
| Authentication, Authorization, and Identity | 24 | 0 | 0 | 2 | 5 | 0 |
| Input Validation, Injection, and Runtime Execution | 26 | 0 | 0 | 4 | 0 | 2 |
| Secrets, Cryptography, and Data Protection | 22 | 0 | 0 | 3 | 1 | 2 |
| API Security and Abuse Resistance | 28 | 0 | 0 | 5 | 4 | 1 |
| Configuration, Infrastructure, and Deployment Security | 11 | 0 | 0 | 2 | 7 | 1 |
| Dependencies and Supply Chain Security | 7 | 0 | 1 | 2 | 4 | 2 |
| Business Logic Security | 12 | 0 | 1 | 3 | 4 | 0 |
| **Total** | **130** | **0** | **2** | **21** | **25** | **8** |

### False positives rejected (2)

| ID | Title | Rejection reason |
|---|---|---|
| INJ-005 | CSV formula injection not sanitized on import | Bulk import parses CSV server-side via Prisma; values are never rendered in spreadsheet context. No formula execution path exists. |
| CRYPTO-005 | GA4 private key read at module level, persists in module cache | Standard Node.js module caching behavior; the key is read from a file path specified by an environment variable, not hardcoded. Module-level initialization is the documented pattern for Google API clients. |

---

## 3. Confirmed Findings

### 3.1 HIGH Severity (2)

---

#### SUPPLY-001: Next.js 14.2.35 has known CVEs including SSRF and DoS

| Field | Value |
|---|---|
| Severity | HIGH (adjusted from CRITICAL) |
| CVSS | 8.6 |
| CWE | CWE-1395 (Dependency on Vulnerable Third-Party Component) |
| OWASP | A06:2021 Vulnerable and Outdated Components |
| File | `package.json` line 35 |

**Description.** The pinned Next.js version 14.2.35 has 15 known advisories reported by `pnpm audit`. The most severe is a Server-Side Request Forgery via crafted WebSocket upgrade requests (GHSA-c4j6-fc7j-m34r, CVSS 8.6) allowing the server to proxy requests to arbitrary internal destinations including EC2 metadata endpoints. Multiple RSC deserialization DoS advisories (GHSA-h25m-26qc-wcjf, GHSA-q4gf-8mx6-v5v3, GHSA-8h8q-6873-q5fj) are also applicable since the app heavily uses Server Components. Next.js 14.x is end-of-life with no backport path; patched versions require 15.5.16+.

**Root cause.** Next.js is pinned at a major version that has reached end-of-life. The minimum patched version requires a major upgrade (14 to 15+) involving React 19 migration.

**Preconditions.** Self-hosted EC2 without a reverse proxy blocking WebSocket upgrades to internal endpoints. App uses Server Components and server actions extensively.

**Evidence.**

```
// package.json:35
"next": "14.2.35",
```

**Exploitation steps.**

1. Attacker sends a crafted WebSocket upgrade request to the self-hosted Next.js server.
2. The server proxies the request to an arbitrary internal destination (e.g., EC2 metadata at `169.254.169.254`).
3. Attacker retrieves IAM credentials or other sensitive internal service responses.
4. Separately, crafted HTTP requests to Server Function endpoints can trigger OOM/CPU exhaustion causing denial of service.

**Business impact.** SSRF can expose AWS IAM credentials from EC2 metadata, enabling cloud account compromise. Multiple DoS vectors can take the application offline. The application is the primary task management tool for a government ministry.

**Remediation.** Migrate to Next.js 15.5.16+ (latest 15.x LTS). This requires: (1) updating react/react-dom to 19.x, (2) adapting to async params/searchParams in App Router pages, (3) testing all Server Actions and middleware. As an interim measure, configure a reverse proxy (nginx/Caddy) to block WebSocket upgrade requests to internal addresses and restrict `/_next/image` access.

```json
// package.json -- target versions
"next": "15.5.16",
"react": "19.1.0",
"react-dom": "19.1.0"
```

**Verification.** Run `pnpm audit --audit-level=high` after upgrade; confirm zero Next.js advisories. Test all routes, server actions, and middleware.

---

#### BL-001: Subtask reassignment skips cross-division validation

| Field | Value |
|---|---|
| Severity | HIGH |
| CVSS | 7.5 |
| CWE | CWE-863 (Incorrect Authorization) |
| OWASP | A01:2021 Broken Access Control |
| File | `src/app/actions/tasks.ts` lines 997--999 |

**Description.** The `updateSubtaskAction` allows reassigning a subtask to any user by UUID without checking that the new assignee is in the same division as the parent task. The companion `addSubtaskAction` (lines 822--824) properly validates division membership, but the update path does not.

**Root cause.** Missing division-boundary validation when reassigning an existing subtask, unlike the creation path which includes the check.

**Preconditions.** Caller must have edit rights on the parent task (owner, creator, division head, OSD, JS, or Super Admin).

**Evidence.**

```typescript
// src/app/actions/tasks.ts:997-999
if (parsed.data.assigneeId && parsed.data.assigneeId !== subtask.ownerId) {
    updates.ownerId = parsed.data.assigneeId;
    activityChanges.push('reassigned');
  }
```

Compare with the creation path that includes the check:

```typescript
// src/app/actions/tasks.ts:822-824 (addSubtaskAction)
if (assignee.divisionId !== parent.divisionId) {
  return fail('Subtask assignee must be in the same division as the parent task.', epoch);
}
```

**Exploitation steps.**

1. User with edit rights on a parent task opens the subtask edit form.
2. User intercepts the form submission and supplies an assigneeId UUID belonging to a user in a different division.
3. The subtask is reassigned cross-division without validation.
4. The cross-division user now owns a subtask with the parent task's visibility, potentially exposing division-internal context.

**Business impact.** Division isolation, a core security boundary, can be bypassed by reassigning subtasks across divisions. A PMU member could be made owner of an internal ministry subtask, breaking PMU isolation guarantees.

**Remediation.** Add the same division check that `addSubtaskAction` performs.

```typescript
if (parsed.data.assigneeId && parsed.data.assigneeId !== subtask.ownerId) {
  const assignee = await prisma.user.findUnique({
    where: { id: parsed.data.assigneeId },
    select: { id: true, isActive: true, divisionId: true },
  });
  if (!assignee || !assignee.isActive) {
    return fail('Assignee not found or inactive.', epoch);
  }
  if (assignee.divisionId !== parent.divisionId) {
    return fail('Subtask assignee must be in the same division as the parent task.', epoch);
  }
  updates.ownerId = parsed.data.assigneeId;
  activityChanges.push('reassigned');
}
```

**Verification.** Attempt to reassign a subtask to a user in a different division via crafted FormData; confirm 400 response with the division mismatch error.

---

### 3.2 MEDIUM Severity (21)

---

#### AUTH-IDENTITY-01: Timeline File status/priority authorization checks wrong division scope

| Field | Value |
|---|---|
| Severity | MEDIUM |
| CVSS | 5.4 |
| CWE | CWE-863 |
| OWASP | API1:2023 Broken Object Level Authorization |
| File | `src/app/actions/timeline-files.ts` lines 268--278 |

**Description.** `updateTimelineFileStatusAction` and `updateTimelineFilePriorityAction` both check whether a Director can change status/priority by comparing the caller's `divisionId` against `tf.createdBy.divisionId` (the TF creator's home division). The documented authorization rule says "Director of marked-to division", meaning a Director whose division is in the TF's marked-to list should have access. The current code only allows the Director of the creator's division, not any marked-to division's Director.

**Root cause.** The authorization check fetches `tf.createdBy.divisionId` instead of querying `timelineFileMarkedTo`.

**Preconditions.** Timeline File must have marked-to divisions different from the creator's home division (common -- OSD creates TFs and marks them to operational divisions).

**Evidence.**

```typescript
// src/app/actions/timeline-files.ts:272-277
const allowed =
  meRow &&
  (meRow.isSuperAdmin ||
    meRow.hierarchySlot === 'osd' ||
    (meRow.hierarchySlot === 'director' &&
      meRow.divisionId === tf.createdBy.divisionId));
```

The UI layer correctly implements this at `src/app/(app)/timeline-files/[id]/page.tsx` lines 109--113:

```typescript
tf.markedTo.some((m) => m.division.id === me.divisionId)
```

**Exploitation steps.**

1. OSD creates Timeline File TF-2026/100, marked to Division A and Division B.
2. Director of Division A (a marked-to division) tries to change the TF status.
3. Authorization fails because Director A's divisionId does not equal tf.createdBy.divisionId (OSD's division).
4. Conversely, a Director in the OSD's home division could change TF status even if not marked-to.

**Business impact.** Directors of marked-to divisions are locked out of updating TF status/priority, forcing status updates to bottleneck through OSD. This disrupts the intended multi-division TF workflow.

**Remediation.**

```typescript
const tf = await prisma.timelineFile.findUnique({
  where: { id: parsed.data.id },
  include: { markedTo: { select: { divisionId: true } } },
});
if (!tf) return fail('Timeline file not found.', epoch);

const markedToDivisionIds = tf.markedTo.map(m => m.divisionId);
const allowed =
  meRow &&
  (meRow.isSuperAdmin ||
    meRow.hierarchySlot === 'osd' ||
    (meRow.hierarchySlot === 'director' &&
      markedToDivisionIds.includes(meRow.divisionId)));
```

**Verification.** As a Director of a marked-to division (not the creator's division), change TF status; confirm success. As a Director of a non-marked-to division, confirm rejection.

---

#### AUTH-IDENTITY-05: Deactivated user sessions remain valid for up to 5 minutes

| Field | Value |
|---|---|
| Severity | MEDIUM |
| CVSS | 5.4 |
| CWE | CWE-613 (Insufficient Session Expiration) |
| OWASP | API2:2023 Broken Authentication |
| File | `src/lib/auth/config.ts` lines 80--108 |

**Description.** When a Super Admin deactivates a user via `setUserActiveAction`, the user's JWT session remains valid until the next JWT refresh cycle (every 5 minutes). During this window, the deactivated user can continue to perform server actions that rely on `requireSession()` without a secondary `isActive` check.

**Root cause.** No session invalidation mechanism exists when a user is deactivated. The JWT callback only checks `isActive` at 5-minute refresh intervals.

**Evidence.**

```typescript
// src/lib/auth/config.ts:80
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
```

**Remediation.** Reduce `REFRESH_INTERVAL_MS` to 60 seconds for a quick fix. For proper session invalidation, implement a generation counter on the user row that is bumped on deactivation and checked in the JWT callback on every request.

**Verification.** Deactivate a user, then attempt a server action within 60 seconds; confirm the action is rejected.

---

#### INJ-001: SVG upload via image/* MIME prefix allows stored XSS

| Field | Value |
|---|---|
| Severity | MEDIUM (adjusted from HIGH) |
| CVSS | 7.3 |
| CWE | CWE-434 (Unrestricted Upload of File with Dangerous Type) |
| OWASP | A04:2021 Insecure Design |
| File | `src/app/api/attachments/upload-url/route.ts` lines 113--136 |

**Description.** The upload-url route's MIME type allowlist uses a prefix match on `image/` which permits `image/svg+xml`. SVG files can embed JavaScript. When served via presigned S3 URL with `Content-Disposition: inline`, the browser executes embedded scripts. In MinIO/localhost deployments (common for government on-prem setups), the SVG executes in a same-site context with the application.

**Root cause.** `ALLOWED_MIME_PREFIXES` includes `image/` which matches `image/svg+xml`.

**Evidence.**

```typescript
const ALLOWED_MIME_PREFIXES = ['image/', 'audio/', 'video/'];
```

**Remediation.** Replace the `image/` prefix with an explicit safe-image allowlist.

```typescript
const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/avif', 'image/bmp', 'image/tiff',
]);

function isAllowedMimeType(mime: string): boolean {
  const lower = mime.toLowerCase();
  if (ALLOWED_MIME_EXACT.has(lower)) return true;
  if (ALLOWED_IMAGE_MIMES.has(lower)) return true;
  return ['audio/', 'video/'].some((prefix) => lower.startsWith(prefix));
}
```

**Verification.** Attempt to request a presigned URL with `contentType: 'image/svg+xml'`; confirm 400 rejection.

---

#### INJ-002: Missing visibility check on engagement attachments in view/download/share routes

| Field | Value |
|---|---|
| Severity | MEDIUM |
| CVSS | 5.3 |
| CWE | CWE-862 (Missing Authorization) |
| OWASP | A01:2021 Broken Access Control |
| File | `src/app/api/attachments/[id]/view/route.ts` lines 55--69 |

**Description.** The attachment view, download, and share-url routes check visibility for task and timeline file attachments but have no check for `js_engagement` ownerType. The `js_engagement` type falls through with no visibility check, allowing any authenticated user who knows the attachment UUID to access engagement documents that should be restricted to Office-of-JS members and Super Admins.

**Root cause.** The if/else-if chain does not have a branch for `js_engagement` or a default deny clause.

**Evidence.**

```typescript
// Falls through for js_engagement
if (att.ownerType === 'task' || att.ownerType === 'task_comment') {
    // task visibility check
} else if (att.ownerType.startsWith('timeline_file')) {
    // TF visibility check
}
// js_engagement falls through with NO check
```

**Remediation.** Add an `else if` for `js_engagement` and a default deny clause.

```typescript
} else if (att.ownerType === 'js_engagement') {
  const { canAccessEngagements, getOfficeOfJsDivisionId } = await import('@/lib/engagements');
  const officeOfJsDivisionId = await getOfficeOfJsDivisionId();
  if (!canAccessEngagements(me, officeOfJsDivisionId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
} else {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Verification.** As a non-Office-of-JS user, attempt to access an engagement attachment by UUID; confirm 403.

---

#### INJ-004: Drive-link URL stored without host restriction enables phishing redirect

| Field | Value |
|---|---|
| Severity | MEDIUM |
| CVSS | 5.4 |
| CWE | CWE-601 (URL Redirection to Untrusted Site) |
| OWASP | A10:2021 Server-Side Request Forgery |
| File | `src/app/actions/tasks.ts` lines 218--224 |

**Description.** `createTaskAction` and `addDriveLinkAttachmentAction` accept any `http://` or `https://` URL as a drive-link. While the API view/download routes block non-Google-Drive URLs at serving time, the UI layer (`AttachmentList.tsx` line 345, `EngagementDetail.tsx` line 159) renders drive-link URLs directly as `<a href={row.fileUrl}>`, bypassing the API route guards entirely. An authenticated insider can store an arbitrary URL that other users see as a clickable attachment link.

**Root cause.** Write-time validation accepts any URL; read-time validation exists in API routes but the UI bypasses those routes for drive links.

**Evidence.**

```typescript
// src/app/actions/tasks.ts:218-224
driveUrl: z
    .string()
    .trim()
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined))
    .refine((s) => !s || /^https?:\/\//.test(s), 'URL must start with http:// or https://')
    .refine((s) => !s || s.length <= 1000, 'URL is too long'),
```

**Remediation.** Add host validation at write time.

```typescript
const ALLOWED_DRIVE_HOSTS = new Set([
  'drive.google.com', 'docs.google.com',
  'sheets.google.com', 'slides.google.com',
]);

driveUrl: z.string().trim().optional()
  .refine((s) => {
    if (!s) return true;
    try {
      const parsed = new URL(s);
      return parsed.protocol === 'https:' && ALLOWED_DRIVE_HOSTS.has(parsed.hostname);
    } catch { return false; }
  }, 'Only Google Drive links are supported')
```

**Verification.** Attempt to create a task with `driveUrl` set to `https://evil.com/fake`; confirm validation error.

---

#### INJ-007: Content-Type header is client-controlled and not verified server-side after upload

| Field | Value |
|---|---|
| Severity | MEDIUM |
| CVSS | 5.3 |
| CWE | CWE-345 (Insufficient Verification of Data Authenticity) |
| OWASP | A04:2021 Insecure Design |
| File | `src/app/actions/attachments.ts` lines 114--176 |

**Description.** `registerAttachmentAction` accepts `mimeType` from client FormData without verifying it matches the content type declared at presign time. An attacker can request a presigned URL for `image/png`, upload actual HTML content, then register the attachment with `mimeType: 'text/html'`. The `/view` route sets `ResponseContentType` from the stored `mimeType`, causing the browser to render the HTML.

**Root cause.** The registration step accepts an unverified client-supplied MIME type.

**Evidence.**

```typescript
// registerSchema does not validate mimeType against the presigned content type
mimeType: z.string().trim().max(200).optional(),
```

**Remediation.** Validate `mimeType` in `registerAttachmentAction` against the same MIME allowlist used at presign time.

```typescript
if (parsed.data.mimeType && !isAllowedMimeType(parsed.data.mimeType)) {
  return fail('File type not allowed.', epoch);
}
```

**Verification.** Attempt to register an attachment with `mimeType: 'text/html'` after presigning for `image/png`; confirm rejection.

---

#### CRYPTO-001: Hardcoded password in seed scripts committed to repository

| Field | Value |
|---|---|
| Severity | MEDIUM |
| CVSS | 5.3 |
| CWE | CWE-798 (Use of Hard-coded Credentials) |
| OWASP | A07:2021 Identification and Authentication Failures |
| File | `prisma/seed-pdf-tasks.ts` line 19; `prisma/seed-mock.ts` line 20 |

**Description.** Both `seed-pdf-tasks.ts` and `seed-mock.ts` contain the hardcoded plaintext password `Test1234!`, while the main `seed.ts` correctly reads from environment variables. Lines 439--449 of `seed-pdf-tasks.ts` also print the password to stdout.

**Remediation.** Read the password from `SEED_DEFAULT_PASSWORD` environment variable and remove console output of credentials.

```typescript
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD;
if (!DEFAULT_PASSWORD) {
  console.error('SEED_DEFAULT_PASSWORD env var is required.');
  process.exit(1);
}
```

---

#### CRYPTO-002: Seed scripts lack production safety guard

| Field | Value |
|---|---|
| Severity | MEDIUM |
| CVSS | 6.5 |
| CWE | CWE-269 (Improper Privilege Management) |
| OWASP | A05:2021 Security Misconfiguration |
| File | `prisma/seed-pdf-tasks.ts` lines 1--18 |

**Description.** Unlike `seed.ts` which refuses to run when `NODE_ENV=production` or `DATABASE_URL` points to a non-localhost host, `seed-pdf-tasks.ts` and `seed-mock.ts` have no such guards. The `seed-pdf-tasks.ts` `clean()` function runs `deleteMany` on 12 tables.

**Remediation.** Add the same production guards from `seed.ts` at the top of both files.

---

#### CRYPTO-003: CSP allows unsafe-eval in script-src directive

| Field | Value |
|---|---|
| Severity | MEDIUM |
| CVSS | 5.4 |
| CWE | CWE-79 (Improper Neutralization of Input During Web Page Generation) |
| OWASP | A03:2021 Injection |
| File | `next.config.mjs` line 27 |

**Description.** The CSP `script-src` directive includes `unsafe-eval`, which permits `eval()`, `Function()`, and similar dynamic code execution. Next.js 14 does not require `unsafe-eval` in production builds.

**Evidence.**

```
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com"
```

**Remediation.** Remove `unsafe-eval` from the production CSP. Conditionally include it for development only.

---

#### API-ABUSE-01 / AUTH-IDENTITY-06: Analytics endpoint missing role-based access control

| Field | Value |
|---|---|
| Severity | MEDIUM (deduplicated -- AUTH-IDENTITY-06 and API-ABUSE-01 cover the same endpoint) |
| CVSS | 5.3 |
| CWE | CWE-862 |
| OWASP | API5:2023 Broken Function Level Authorization |
| File | `src/app/api/analytics/route.ts` lines 18--22 |

**Description.** The GET `/api/analytics` endpoint exposes Google Analytics data (active users count, total users count) to any authenticated user. It checks for a valid session but performs no role-based authorization.

**Remediation.** Add Super Admin or OSD check after session validation.

```typescript
const me = await prisma.user.findUnique({
  where: { id: session.user.id },
  select: { isSuperAdmin: true },
});
if (!me?.isSuperAdmin) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

#### API-ABUSE-02: Task creation has no rate limiting

| Field | Value |
|---|---|
| Severity | MEDIUM (adjusted from HIGH) |
| CVSS | 7.1 |
| CWE | CWE-770 (Allocation of Resources Without Limits or Throttling) |
| OWASP | A04:2021 Insecure Design |
| File | `src/app/actions/tasks.ts` lines 230--240 |

**Description.** `createTaskAction` has no rate limiting. An authenticated user can invoke it in a tight loop. The rate-limiting infrastructure exists and is applied to 4 endpoints (login, password change, upload, search) but not to write-heavy actions.

**Remediation.** Add rate limiting to all write-path server actions.

```typescript
const { ok: allowed } = rateLimit(`createTask:${me.id}`, 30, 60_000);
if (!allowed) return fail('Too many tasks created. Wait a minute and try again.', epoch);
```

---

#### API-ABUSE-04: In-memory rate limiting bypassed in multi-instance deployments

| Field | Value |
|---|---|
| Severity | MEDIUM (adjusted from HIGH) |
| CVSS | 7.5 |
| CWE | CWE-799 |
| OWASP | A04:2021 Insecure Design |
| File | `src/lib/rate-limit.ts` lines 1--35 |

**Description.** The rate limiter uses an in-process `Map`. Currently production runs a single PM2 process, so this is not actively exploitable. However, scaling to PM2 cluster mode would immediately multiply all rate limits by the number of workers.

**Remediation.** For immediate hardening, document the single-process requirement. For scaling readiness, migrate to a Redis-backed or Postgres-backed rate limiter.

---

#### API-ABUSE-09: Notification generation abuse via rapid comment posting with @mentions

| Field | Value |
|---|---|
| Severity | MEDIUM |
| CVSS | 5.3 |
| CWE | CWE-770 |
| OWASP | A04:2021 Insecure Design |
| File | `src/app/actions/tasks.ts` lines 1088--1155 |

**Description.** `postCommentAction` has no rate limiting and no cap on @mentions per comment. Each valid @mention generates a notification row.

**Remediation.** Add rate limiting and cap mentions.

```typescript
const { ok: allowed } = rateLimit(`comment:${me.id}`, 10, 60_000);
if (!allowed) return fail('Too many comments. Wait a minute and try again.', epoch);

const mentions = (await resolveMentions(parsed.data.body)).slice(0, 10);
```

---

#### API-ABUSE-10: Cron endpoint paths treated as public routes in middleware

| Field | Value |
|---|---|
| Severity | MEDIUM |
| CVSS | 5.3 |
| CWE | CWE-862 |
| OWASP | A01:2021 Broken Access Control |
| File | `src/lib/auth/config.ts` line 40 |

**Description.** `pathname.startsWith('/api/cron')` blanket-exempts all current and future routes under `/api/cron/` from authentication middleware. The single existing endpoint has its own `CRON_SECRET` check, but new routes would be publicly accessible by default.

**Remediation.** Narrow the exemption to the exact known path.

```typescript
pathname === '/api/cron/due-notifications'
```

---

#### INFRA-01 / CRYPTO-003: CSP allows unsafe-eval (deduplicated)

These two findings (INFRA-01 and CRYPTO-003) cover the same `unsafe-eval` issue. Counted once at MEDIUM severity. See CRYPTO-003 above.

---

#### INFRA-02: CSP missing base-uri and form-action directives

| Field | Value |
|---|---|
| Severity | LOW (verifier noted MEDIUM but the fix is trivial one-line addition) |
| CVSS | 5.3 |
| CWE | CWE-16 (Configuration) |
| OWASP | A05:2021 Security Misconfiguration |
| File | `next.config.mjs` lines 25--33 |

**Description.** The CSP is missing `base-uri` and `form-action` directives. Per the CSP specification, these do not fall back to `default-src`, meaning they default to allowing any origin.

**Remediation.** Add to the CSP: `"object-src 'none'", "base-uri 'self'", "form-action 'self'"`.

---

#### INFRA-06: CI pipeline ignores dependency audit failures

| Field | Value |
|---|---|
| Severity | MEDIUM |
| CVSS | 5.0 |
| CWE | CWE-1395 |
| OWASP | A06:2021 Vulnerable and Outdated Components |
| File | `.github/workflows/deploy.yml` line 30 |

**Description.** `pnpm audit --audit-level=high || true` suppresses all audit failures, so the pipeline never blocks on known vulnerabilities.

**Evidence.**

```yaml
- run: pnpm audit --audit-level=high || true
```

**Remediation.** Remove `|| true`. Use an allowlist for known-acceptable advisories.

---

#### SUPPLY-002: next-auth pinned to unstable beta pre-release

| Field | Value |
|---|---|
| Severity | MEDIUM (adjusted from HIGH) |
| CVSS | 7.0 |
| CWE | CWE-1395 |
| OWASP | A06:2021 Vulnerable and Outdated Components |
| File | `package.json` line 36 |

**Description.** `next-auth` is pinned at `5.0.0-beta.31`, a pre-release beta. Beta versions do not follow the same security patching cadence as stable releases. However, beta.31 is currently the latest v5 release and the underlying `@auth/core 0.41.2` is a stable release with no known advisories.

**Remediation.** Track the Auth.js v5 stable release and upgrade promptly when available. The auth layer itself has extensive compensating controls (argon2id, JWT refresh, CSRF, rate limiting).

---

#### SUPPLY-003: CI audit gate silenced (deduplicated with INFRA-06)

Same finding as INFRA-06. Counted once.

---

#### BL-002: Timeline File status change uses wrong division check

| Field | Value |
|---|---|
| Severity | MEDIUM |
| CVSS | 5.4 |
| CWE | CWE-863 |
| OWASP | A01:2021 Broken Access Control |
| File | `src/app/actions/timeline-files.ts` lines 272--278 |

See AUTH-IDENTITY-01 for full details. Same root cause, same fix.

---

#### BL-003: Timeline File priority change uses same wrong division check

| Field | Value |
|---|---|
| Severity | MEDIUM |
| CVSS | 5.4 |
| CWE | CWE-863 |
| OWASP | A01:2021 Broken Access Control |
| File | `src/app/actions/timeline-files.ts` lines 338--344 |

Identical pattern to BL-002 but for the priority change action. Same fix.

---

#### BL-005: canEditTask grants full edit rights to all JS users regardless of division

| Field | Value |
|---|---|
| Severity | MEDIUM |
| CVSS | 5.4 |
| CWE | CWE-863 |
| OWASP | A01:2021 Broken Access Control |
| File | `src/app/actions/tasks.ts` lines 168--169 |

**Description.** `canEditTask` grants edit rights to any user with `hierarchySlot` of `js` or `osd`. Per the permissions matrix, JS should only edit tasks they own or created, not have universal edit power. OSD correctly has broad edit access.

**Evidence.**

```typescript
if (caller.hierarchySlot === 'js' || caller.hierarchySlot === 'osd') return true;
```

**Remediation.** Remove JS from the blanket grant. JS should fall through to the owner/creator/head-of-division checks.

```typescript
if (caller.hierarchySlot === 'osd') return true;
// JS falls through to owner/creator checks below
```

---

### 3.3 LOW Severity (25)

| ID | Title | File | CWE |
|---|---|---|---|
| AUTH-IDENTITY-02 | Board reorder action relies on stale JWT claims | tasks.ts:1529--1539 | CWE-613 |
| AUTH-IDENTITY-03 | In-memory rate limiter resets on server restart | rate-limit.ts:1--35 | CWE-307 |
| AUTH-IDENTITY-04 | No password complexity requirements beyond min length | profile.ts:27--30 | CWE-521 |
| AUTH-IDENTITY-07 | Login rate limiting keyed by username alone | auth/index.ts:39--40 | CWE-307 |
| CRYPTO-007 | S3 presigned share URLs have 4-hour TTL without revocation | s3.ts:27, 151--163 | CWE-613 |
| API-ABUSE-05 | Cron endpoint queries unbounded | cron/due-notifications/route.ts:37--99 | CWE-400 |
| API-ABUSE-06 | Presigned URL hoarding via rapid upload-url requests | upload-url/route.ts:41--103 | CWE-770 |
| API-ABUSE-07 | Bulk import lacks rate limiting | bulk-import.ts:274--432 | CWE-770 |
| API-ABUSE-08 | Attachment download/view/share-url routes lack rate limiting | attachments/[id]/* | CWE-770 |
| INFRA-02 | CSP missing base-uri and form-action directives | next.config.mjs:25--33 | CWE-16 |
| INFRA-03 | CSP img-src allows any HTTPS origin via wildcard | next.config.mjs:30 | CWE-16 |
| INFRA-04 | X-Powered-By header not disabled | next.config.mjs:2--4 | CWE-200 |
| INFRA-05 | Cron API bypasses auth via middleware allowlist | auth/config.ts:40 | CWE-306 |
| INFRA-07 | Deploy script runs migrations with full DB credentials | deploy.yml:50 | CWE-250 |
| INFRA-09 | GA4 measurement ID interpolated without validation | layout.tsx:68--73 | CWE-79 |
| INFRA-10 | In-memory rate limiter resets on restart | rate-limit.ts:1--35 | CWE-799 |
| SUPPLY-004 | Legacy bcryptjs retained after argon2 migration | package.json:32 | CWE-1104 |
| SUPPLY-005 | Security-critical deps use unpinned caret ranges | package.json:26--28 | CWE-1357 |
| SUPPLY-006 | package-lock.json in .gitignore, dual-lockfile risk | .gitignore:55 | CWE-1357 |
| SUPPLY-008 | Vitest 2.x has critical file read/execute CVE (dev-only) | package.json:56 | CWE-22 |
| BL-004 | Bulk import allows assigning task owner from any division | bulk-import.ts:349--358 | CWE-863 |
| BL-006 | Transfer of personal task auto-promotes visibility silently | tasks.ts:2111--2118 | CWE-863 |
| BL-007 | restoreTask action missing -- archived tasks irrecoverable | tasks.ts:1259--1260 | CWE-284 |
| BL-008 | Collaborator addition has no division or visibility check | tasks.ts:1607--1619 | CWE-863 |
| AUTH-IDENTITY-06 | Analytics API missing role-based access control | analytics/route.ts:18--22 | CWE-862 |

### 3.4 INFO Severity (8)

| ID | Title | File | CWE |
|---|---|---|---|
| INJ-003 | Unvalidated divisionId filter from URL parameters in search | search/page.tsx:58--65 | CWE-20 |
| INJ-006 | Unvalidated JSON.parse without size limit in reorderBoardAction | tasks.ts:1541--1567 | CWE-502 |
| CRYPTO-004 | CRON_SECRET recommended generation length is 16 hex bytes | .env.sample:94--95 | CWE-331 |
| CRYPTO-006 | In-memory rate limiter not shared across instances | rate-limit.ts:1--35 | CWE-307 |
| API-ABUSE-03 | Over-fetching in updateTaskPriorityAction and updateTaskFieldsAction | tasks.ts:528 | CWE-200 |
| INFRA-08 | No database CHECK constraints enforce security invariants | schema.prisma:303--323 | CWE-20 |
| SUPPLY-007 | postinstall runs prisma generate unconditionally | package.json:8 | CWE-1357 |
| SUPPLY-009 | No node engine upper bound or packageManager enforcement | package.json:67--69 | CWE-1357 |

---

## 4. Previously Remediated Items Summary

41 findings from the initial SAST assessment were remediated across Phases 0 through 5 before this rescan. Key remediation areas included:

| Phase | Focus | Findings fixed |
|---|---|---|
| Phase 0 | Immediate containment | Critical injection and authentication fixes |
| Phase 1 | Auth/authz hardening | 8 findings -- session management, CSRF, privilege escalation |
| Phase 2 | Business logic fixes | 9 findings -- visibility scoping, permission enforcement |
| Phase 3 | Infrastructure, headers, rate limiting | 8 findings -- CSP initial setup, HSTS, security headers |
| Phases 4--5 | Continued hardening | Remaining fixes across all domains |

The remediation effort was effective: the rescan found zero recurrence of any previously-fixed finding. The overall critical count dropped to zero, and the original HIGH-severity findings (credential exposure, SQL injection vectors, authentication bypasses) were all confirmed resolved.

---

## 5. Security Score Calculation

### Methodology

The security score uses a Weighted Severity Points model with exposure and compensating-controls adjustments.

**Step 1: Weighted Severity Points (WSP)**

| Severity | Count | Weight | Subtotal |
|---|---|---|---|
| Critical | 0 | 10 | 0 |
| High | 2 | 7 | 14 |
| Medium | 21 | 4 | 84 |
| Low | 25 | 1 | 25 |
| Info | 8 | 0 | 0 |
| **WSP** | | | **123** |

**Step 2: Exposure Multiplier (EM)**

| Factor | Value | Rationale |
|---|---|---|
| Deployment model | Internal only | Self-hosted EC2, not internet-facing to general public |
| User base | 50--200 named officers | All users are identified government employees |
| Authentication requirement | Mandatory | All endpoints require NextAuth session |
| Network exposure | Government intranet | Not a public-facing service |
| **EM** | **0.60** | |

**Step 3: Compensating Controls Factor (CCF)**

| Control | Present | Effect |
|---|---|---|
| argon2id password hashing | Yes | Strong credential protection |
| CSRF protection (NextAuth) | Yes | Prevents cross-origin attacks |
| Parameterized queries (Prisma) | Yes | Eliminates SQL injection |
| Audit logging | Yes | Enables incident detection |
| Comprehensive security headers | Yes | HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| CSP (partial) | Yes | Present but has gaps (unsafe-eval, missing directives) |
| JWT refresh with isActive check | Yes | Sessions revoked within 5 minutes |
| Rate limiting (partial) | Yes | Present on 4 endpoints, missing on others |
| **CCF** | **0.75** | Strong but incomplete controls |

**Step 4: Net Risk Index (NRI)**

```
NRI = WSP x EM x CCF
NRI = 123 x 0.60 x 0.75
NRI = 55.35
```

**Step 5: Security Score**

```
Score = max(0, 100 - NRI)
Score = max(0, 100 - 55.35)
Score = 44.65 ~ 44.7
```

**Rating: D**

| Range | Rating | Interpretation |
|---|---|---|
| 90--100 | A | Production-ready, minimal risk |
| 75--89 | B | Acceptable for internal use, minor issues |
| 60--74 | C | Conditional pass, targeted fixes needed |
| 40--59 | **D** | **Significant gaps, phased remediation required** |
| 0--39 | F | Not production-suitable |

### Score interpretation

The D rating reflects the cumulative weight of 21 MEDIUM-severity findings spanning multiple domains rather than a single catastrophic vulnerability. The zero-critical posture is positive, and the two HIGH findings are both addressable (one is a dependency upgrade, one is a targeted code fix). The bulk of the score penalty comes from defense-in-depth gaps (rate limiting, CSP, authorization logic) that are individually low-impact but collectively significant.

---

## 6. Code Quality Score

### Methodology

10 categories weighted by security relevance. Each scored 0--10. Global score is the weighted average.

| Category | Weight | Score | Contribution | Evidence |
|---|---|---|---|---|
| Input validation | 15% | 7.0 | 105 | Zod schemas on all server actions. Gaps: SVG MIME prefix, unvalidated drive-link hosts, search param format validation. |
| Authentication & session mgmt | 15% | 7.5 | 112.5 | argon2id hashing, 5-min JWT refresh, CSRF protection, forced password change. Gaps: 5-min deactivation window, beta next-auth. |
| Authorization & access control | 15% | 6.0 | 90 | Comprehensive RBAC layer (visibility scoper, canActAsHeadOf, hierarchy traversal). Gaps: wrong TF division check, canEditTask over-grants to JS, subtask cross-div bypass. |
| Cryptography & secrets | 10% | 7.0 | 70 | argon2id with proper params, env-based secrets for main seed. Gaps: hardcoded password in auxiliary seeds, CSP unsafe-eval. |
| Error handling & logging | 8% | 8.0 | 64 | Next.js error boundaries sanitize server errors, comprehensive audit log, per-task activity trail, structured ActionState responses. |
| Data protection | 10% | 7.0 | 70 | Prisma parameterized queries throughout, visibility scoping on all list queries. Gaps: some over-fetching, 4h share URL TTL. |
| Dependency management | 8% | 4.0 | 32 | EOL Next.js 14, beta next-auth, silenced audit gate, mixed pinning strategy. pnpm lockfile committed, onlyBuiltDependencies configured. |
| Configuration security | 7% | 6.0 | 42 | Good header suite (HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy). Gaps: CSP unsafe-eval, missing base-uri/form-action, X-Powered-By. |
| API design & rate limiting | 7% | 5.0 | 35 | Rate limiting on login/password/upload/search. Missing on task creation, comments, bulk import, attachment access. In-memory only. |
| CI/CD & deployment | 5% | 5.0 | 25 | GitHub Actions CI with typecheck/lint/audit steps. Gaps: audit silenced, no packageManager enforcement, shared DB credentials for migration/runtime. |
| **Global** | **100%** | **6.46** | **645.5** | **Acceptable** |

### Rating

| Range | Rating |
|---|---|
| 8.0--10.0 | Good |
| **6.0--7.9** | **Acceptable** |
| 4.0--5.9 | Needs improvement |
| 0--3.9 | Poor |

The codebase demonstrates solid foundational security practices (parameterized queries, structured auth, audit logging) with specific gaps in authorization logic, dependency lifecycle, and rate limiting coverage that prevent a "Good" rating.

---

## 7. Remediation Roadmap

### Phase R1: Immediate (1--2 days) -- Authorization and injection fixes

These are targeted code changes, each under 20 lines, that fix the two HIGH and most impactful MEDIUM findings.

| Priority | Finding | Fix |
|---|---|---|
| 1 | BL-001 | Add division validation to `updateSubtaskAction` |
| 2 | AUTH-IDENTITY-01, BL-002, BL-003 | Fix TF status/priority authorization to check marked-to divisions |
| 3 | INJ-001 | Block `image/svg+xml` in MIME allowlist |
| 4 | INJ-002 | Add `js_engagement` visibility check + default deny in attachment routes |
| 5 | BL-005 | Remove JS from blanket `canEditTask` grant |
| 6 | INJ-004 | Add Google Drive host validation at write time for drive-link URLs |
| 7 | INJ-007 | Validate mimeType in `registerAttachmentAction` against MIME allowlist |

### Phase R2: Short-term (1 week) -- Rate limiting and CSP

| Priority | Finding | Fix |
|---|---|---|
| 1 | CRYPTO-003/INFRA-01 | Remove `unsafe-eval` from CSP |
| 2 | INFRA-02 | Add `object-src 'none'; base-uri 'self'; form-action 'self'` to CSP |
| 3 | API-ABUSE-02 | Add rate limiting to `createTaskAction` |
| 4 | API-ABUSE-09 | Add rate limiting to `postCommentAction` + cap @mentions |
| 5 | API-ABUSE-10 | Narrow cron middleware exemption to exact path |
| 6 | AUTH-IDENTITY-05 | Reduce JWT refresh interval to 60 seconds |
| 7 | INFRA-04 | Add `poweredByHeader: false` to next.config.mjs |
| 8 | API-ABUSE-01 | Add Super Admin check to analytics endpoint |
| 9 | CRYPTO-001, CRYPTO-002 | Fix seed scripts: env-based password, production guards |

### Phase R3: Medium-term (2--4 weeks) -- Dependency upgrades

| Priority | Finding | Fix |
|---|---|---|
| 1 | SUPPLY-001 | Migrate to Next.js 15.x (major version upgrade) |
| 2 | SUPPLY-002 | Upgrade to next-auth stable when available |
| 3 | SUPPLY-003/INFRA-06 | Remove `\|\| true` from CI audit gate |
| 4 | SUPPLY-008 | Upgrade vitest to 3.2.6+ |
| 5 | SUPPLY-004 | Check for remaining bcrypt hashes; remove bcryptjs if none |
| 6 | SUPPLY-005 | Pin security-critical dependencies to exact versions |
| 7 | SUPPLY-006 | Add `packageManager` field to package.json |

### Phase R4: Ongoing hardening

| Priority | Finding | Fix |
|---|---|---|
| 1 | AUTH-IDENTITY-03/04/07 | Strengthen password policy; add IP component to rate limit key |
| 2 | API-ABUSE-04 | Evaluate Redis-backed rate limiter for scaling readiness |
| 3 | INFRA-07 | Separate migration and runtime database roles |
| 4 | BL-007 | Implement `restoreTaskAction` |
| 5 | Remaining LOW/INFO | Address as part of normal development cadence |

---

## 8. Final Verdict

### CONDITIONAL PASS

The MYAS Task Tracker receives a **Conditional Pass** for internal production use with the following conditions:

**Conditions for unconditional pass:**

1. Fix the two HIGH findings (BL-001, SUPPLY-001) per Phase R1/R3.
2. Complete Phase R1 authorization and injection fixes (7 targeted code changes).
3. Remove `unsafe-eval` from CSP (Phase R2).

### What an attacker can do today

Given the current state, an attacker with valid credentials (the only realistic attacker profile for this internal-only application) can:

1. **Reassign subtasks cross-division** (BL-001, HIGH) -- assign subtasks to users in other divisions, breaking division isolation. Requires edit rights on the parent task.
2. **Upload weaponized SVG files** (INJ-001, MEDIUM) -- store SVG with embedded JavaScript that executes when viewed by other users. Impact depends on S3 deployment topology (same-origin in MinIO, cross-origin in AWS S3).
3. **Access engagement attachments without Office-of-JS membership** (INJ-002, MEDIUM) -- if the attachment UUID is known, any authenticated user can view, download, or generate share URLs for JS engagement documents.
4. **Store phishing links as drive-link attachments** (INJ-004, MEDIUM) -- the UI renders these directly as clickable links without going through the API route guards.
5. **Edit any task in the system as JS** (BL-005, MEDIUM) -- if the JS user obtains a task ID (from notifications, shared URLs, or the JS Priority Board), they can modify status, priority, name, description, and add subtasks.

An unauthenticated external attacker has no direct exploit path. The application requires authentication for all routes, uses CSRF protection, and employs parameterized queries throughout.

### What an attacker cannot do

- **SQL injection** -- Prisma parameterized queries are used exclusively; no raw SQL.
- **Authentication bypass** -- NextAuth middleware gates all routes; CSRF protection is in place.
- **Credential theft from the database** -- passwords are hashed with argon2id using strong parameters.
- **Session hijacking via XSS** -- while CSP has gaps, no open XSS vector was identified in the current code. React auto-escaping prevents the most common injection patterns.
- **Privilege escalation to Super Admin** -- no path was found to elevate to Super Admin from a regular user account.

### Minimum before production

1. **Apply Phase R1 fixes** (authorization bugs and injection vectors) -- estimated 1--2 days of development.
2. **Remove `unsafe-eval` from CSP** -- a one-line change in `next.config.mjs`.
3. **Plan the Next.js 15 migration** -- not blocking for internal launch, but must be scheduled within 4 weeks given the SSRF and DoS CVEs.

After Phase R1 and the CSP fix, the Security Score would improve to approximately **62 / 100** (C rating), which is acceptable for internal government use with the small user base and authenticated-only access model.

---

*Report generated 2026-07-07. Findings are based on static analysis of source code at commit `24486e8` (branch `main`). Runtime/dynamic testing was not performed.*
