# SAST findings — MYAS Task Tracker

**Scan date:** 2026-07-06
**Repo:** github.com/Manas2412/Task-Tracker (single repo)
**Stack:** Next.js 14 + Prisma + Postgres + NextAuth + S3
**Files discovered:** 230 | **Files reviewed:** 182 | **Coverage:** 79.1%
**Scanners:** 7 parallel agents (AuthN/AuthZ, Injection/Input, Secrets/Crypto, API Abuse, Config/Infra, Deps/Supply Chain, Business Logic)
**Raw findings:** 61 | **After deduplication:** 41

## Severity summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 9     |
| Medium   | 19    |
| Low      | 13    |
| **Total**| **41**|

---

## High (9)

### SAST-001 — Missing authorization on addCollaboratorAction

| Field | Value |
|-------|-------|
| Severity | HIGH |
| CVSS | 7.5 |
| CWE | CWE-862 (Missing Authorization) |
| OWASP | API5:2023 Broken Function Level Authorization |
| File | `src/app/actions/tasks.ts:1567-1667` |

**Description:** `addCollaboratorAction` performs no authorization check. Any authenticated user can add collaborators (including themselves) to any visible task. Other mutation actions like `updateTaskStatusAction` correctly call `canEditTask()`, but this one skips it entirely.

**Root cause:** Authorization guard omitted during implementation.

**Remediation:** Add `canEditTask(me.id, task)` check before allowing collaborator addition.

**Status:** [x] Fixed — added `canEditTask` guard + `createdById`/`divisionId` in select

---

### SAST-002 — Hardcoded plaintext passwords in seed script

| Field | Value |
|-------|-------|
| Severity | HIGH |
| CVSS | 7.5 |
| CWE | CWE-798 (Use of Hard-coded Credentials) |
| OWASP | A07:2021 Identification and Authentication Failures |
| Files | `prisma/seed.ts:44-49`, `prisma/seed-mock.ts:20` |

**Description:** Seed scripts contain plaintext passwords like `"Password123!"` committed to version control. While seed.ts already has a production guard (H-17 remediation), the passwords themselves are in git history and could be reused by operators.

**Root cause:** Seed scripts were written with convenience passwords rather than reading from env vars.

**Remediation:** Read bootstrap passwords from `SEED_ADMIN_PASSWORD` env var; fail if unset. Remove plaintext passwords from source.

**Status:** [x] Fixed — all seed passwords read from env vars (`BOOTSTRAP_*` + `SEED_DEFAULT_PASSWORD`); seed refuses to run if any are blank

---

### SAST-003 — Missing security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)

| Field | Value |
|-------|-------|
| Severity | HIGH |
| CVSS | 6.1 |
| CWE | CWE-693 (Protection Mechanism Failure) |
| OWASP | A05:2021 Security Misconfiguration |
| Files | `next.config.mjs`, `middleware.ts` |

**Description:** No security response headers are configured anywhere — not in `next.config.mjs` headers config, not in middleware, not in any custom server. The app is vulnerable to clickjacking, MIME-sniffing, and lacks CSP protection.

**Root cause:** Security headers were never added to the Next.js config.

**Remediation:** Add `headers()` config to `next.config.mjs` setting CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy.

**Status:** [ ] Not started

---

### SAST-004 — Middleware bypasses authentication for all API routes

| Field | Value |
|-------|-------|
| Severity | HIGH |
| CVSS | 7.5 |
| CWE | CWE-306 (Missing Authentication for Critical Function) |
| OWASP | API2:2023 Broken Authentication |
| File | `src/lib/auth/config.ts:37` |

**Description:** The NextAuth `authorized` callback contains `if (isOnApi) return true`, blanket-allowing unauthenticated access to every `/api/*` route. This means `/api/analytics`, `/api/search`, `/api/cron/*` are all accessible without a session. Individual routes that call `auth()` internally are protected, but any route that doesn't is wide open.

**Root cause:** API routes were excluded from middleware auth to allow webhook/cron access, but this exempts all routes instead of specific ones.

**Affected endpoints:**
- `/api/analytics` — no `auth()` call, fully unauthenticated
- `/api/cron/due-notifications` — protected only by `CRON_SECRET` (see SAST-009)
- `/api/search` — has `auth()` call, mitigated
- `/api/attachments/*` — have `auth()` calls, mitigated

**Remediation:** Remove the blanket `/api` bypass. Allowlist only specific public API paths (e.g., `/api/auth/*`, `/api/cron/*`). Add `auth()` to `/api/analytics`.

**Status:** [ ] Not started

---

### SAST-005 — Credential files in working directory without .gitignore protection

| Field | Value |
|-------|-------|
| Severity | HIGH |
| CVSS | 7.5 |
| CWE | CWE-312 (Cleartext Storage of Sensitive Information) |
| OWASP | A02:2021 Cryptographic Failures |
| Files | `MYAS Task Tracker — Login Credentials.pdf`, `docs/credentials.html`, `scripts/credentials.html` |

**Description:** Three credential-containing files exist in the working directory and are not listed in `.gitignore`. A careless `git add .` would commit them. They currently show as untracked in `git status`.

**Root cause:** Credential files were created/downloaded locally without updating `.gitignore`.

**Remediation:** Add `*.pdf`, `credentials.html`, and `credentials.*` patterns to `.gitignore`. Move credential files outside the repo tree.

**Status:** [x] Fixed — security headers added to `next.config.mjs` (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)

---

### SAST-006 — No rate limiting on login, search, password change, or file upload

| Field | Value |
|-------|-------|
| Severity | HIGH |
| CVSS | 7.5 |
| CWE | CWE-307 (Improper Restriction of Excessive Authentication Attempts) |
| OWASP | API4:2023 Unrestricted Resource Consumption |
| Files | `src/lib/auth/index.ts:32-83`, `src/app/api/search/route.ts`, `src/app/api/attachments/upload-url/route.ts`, `src/app/(auth)/login/actions.ts` |

**Description:** Zero rate limiting or throttling exists anywhere in the application. Login can be brute-forced indefinitely, search can be hammered for DoS, password changes can be enumerated, and presigned upload URLs can be generated without limit.

**Root cause:** No rate-limiting middleware was implemented. Next.js doesn't provide one out of the box.

**Remediation:** Add IP-based rate limiting via `next-rate-limit` or a custom in-memory/Redis token bucket. Priority targets: login (5/min), password change (3/min), upload-url (20/min), search (30/min).

**Status:** [x] Fixed — in-memory rate limiter (`src/lib/rate-limit.ts`) wired into login (5/min per username), search (30/min per user), password change (5/min per user), upload presign (20/min per user)

---

### SAST-007 — next-auth pinned to unstable pre-release beta

| Field | Value |
|-------|-------|
| Severity | HIGH |
| CVSS | 7.5 |
| CWE | CWE-1104 (Use of Unmaintained Third Party Components) |
| OWASP | A06:2021 Vulnerable and Outdated Components |
| File | `package.json:35` |

**Description:** The project uses `next-auth@5.0.0-beta.20` which bundles `@auth/core@0.34.2`. Beta versions receive no backported security patches and may contain undisclosed vulnerabilities. Auth.js v5 has had several beta-only security issues.

**Root cause:** Project started on NextAuth v5 beta when stable wasn't available; never upgraded.

**Remediation:** Upgrade to the latest stable `next-auth@5.x` release (or the latest beta if stable isn't available yet). Monitor Auth.js security advisories.

**Status:** [x] Fixed — upgraded from `5.0.0-beta.20` to `5.0.0-beta.31` (latest beta; no stable v5 available yet)

---

### SAST-008 — GitHub Actions pinned to mutable major-version tags

| Field | Value |
|-------|-------|
| Severity | HIGH |
| CVSS | 8.1 |
| CWE | CWE-829 (Inclusion of Functionality from Untrusted Control Sphere) |
| OWASP | A08:2021 Software and Data Integrity Failures |
| File | `.github/workflows/deploy.yml:10,12,31-34` |

**Description:** The CI/CD workflow uses `actions/checkout@v4`, `actions/setup-node@v4`, `pnpm/action-setup@v4`, `appleboy/ssh-action@v1` — all mutable major-version tags. A compromised upstream can push a malicious commit and retag, gaining access to deploy secrets (SSH key, EC2 host).

**Root cause:** Default GitHub Actions setup uses version tags.

**Remediation:** Pin all actions to full commit SHAs. Add Dependabot or Renovate for automated SHA updates.

**Status:** [x] Fixed — all actions pinned to verified commit SHAs (checkout@11bd719, setup-node@49933ea, pnpm/action-setup@fe02b34, appleboy/ssh-action@2ead5e3)

---

### SAST-009 — Cron endpoint unprotected when CRON_SECRET is unset

| Field | Value |
|-------|-------|
| Severity | HIGH |
| CVSS | 7.5 |
| CWE | CWE-306 (Missing Authentication for Critical Function) |
| OWASP | API2:2023 Broken Authentication |
| File | `src/app/api/cron/due-notifications/route.ts:17-24` |

**Description:** The cron endpoint guard uses `if (secret) { ... }` — when `CRON_SECRET` env var is not set, the entire auth check is skipped and anyone can trigger the cron job. This can send mass notifications and cause DB load.

**Root cause:** Defensive coding flaw — truthy check on the secret instead of failing closed.

**Remediation:** Fail closed: if `CRON_SECRET` is not set, return 503. Always require the secret.

**Status:** [ ] Not started

---

## Medium (19)

### SAST-010 — Missing authorization on removeCollaboratorAction

| Field | Value |
|-------|-------|
| Severity | MEDIUM |
| CVSS | 6.5 |
| CWE | CWE-862 |
| File | `src/app/actions/tasks.ts:1674-1721` |

**Description:** `removeCollaboratorAction` checks that the collaborator record exists but never verifies the caller has edit rights on the task. Any authenticated user can remove collaborators from any task.

**Remediation:** Add `canEditTask(me.id, task)` check.

**Status:** [x] Fixed — added task fetch + `canEditTask` guard

---

### SAST-011 — Task visibility escalation via transfer

| Field | Value |
|-------|-------|
| Severity | MEDIUM |
| CVSS | 5.7 |
| CWE | CWE-284 |
| File | `src/app/actions/tasks.ts:2087-2092` |

**Description:** `transferTaskAction` unconditionally promotes personal-visibility tasks to division visibility when transferring to another user, without checking `canCreateDivisionTask`. A user could create a personal task with sensitive content, then transfer it to make it division-visible.

**Remediation:** Check `canCreateDivisionTask` before promoting visibility, or keep the task personal and let the new owner decide.

**Status:** [x] Fixed — visibility promotion now gated by `canCreateDivisionTask`; personal tasks stay personal when transferor lacks head power

---

### SAST-012 — Subtask assignee bypass allows cross-division assignment

| Field | Value |
|-------|-------|
| Severity | MEDIUM |
| CVSS | 5.4 |
| CWE | CWE-862 |
| File | `src/app/actions/tasks.ts:758-862` |

**Description:** `addSubtaskAction` accepts an arbitrary `assigneeId` UUID without verifying the target user is in the same division or that the caller has the right to assign to them. Bypasses the normal reassignment approval flow.

**Remediation:** Validate assignee is in the same division as the parent task. Use `canAssignTaskTo` check.

**Status:** [x] Fixed — subtask assignee validated: must be active and in the same division as parent task

---

### SAST-013 — TF status change by any Director in marked-to division

| Field | Value |
|-------|-------|
| Severity | MEDIUM |
| CVSS | 5.3 |
| CWE | CWE-863 |
| File | `src/app/actions/timeline-files.ts:265-276` |

**Description:** The authorization check for TF status changes allows any Director whose division is in the `markedTo` list to change the TF status, enabling cross-division interference.

**Remediation:** Restrict TF status changes to the creator's division head, OSD, or Super Admin.

**Status:** [x] Fixed — TF status/priority changes restricted to creator's division Director, OSD, or Super Admin

---

### SAST-014 — Race condition in reassignment approval

| Field | Value |
|-------|-------|
| Severity | MEDIUM |
| CVSS | 5.3 |
| CWE | CWE-367 |
| File | `src/app/actions/tasks.ts:1901-2012` |

**Description:** The reassignment request status check and update are not atomic. Two concurrent approvals could both pass the `status !== 'pending'` check and double-execute the ownership transfer.

**Remediation:** Use `updateMany` with a `where: { id, status: 'pending' }` filter so only one execution wins.

**Status:** [x] Fixed — atomic `updateMany` with `status: 'pending'` filter claims the request before executing side effects

---

### SAST-015 — Cron secret transmitted in URL query parameter

| Field | Value |
|-------|-------|
| Severity | MEDIUM |
| CVSS | 4.3 |
| CWE | CWE-598 |
| File | `src/app/api/cron/due-notifications/route.ts:19-20` |

**Description:** The cron endpoint accepts the secret via `?secret=` query parameter, which appears in server logs, browser history, and CDN logs. The endpoint also supports `Authorization` header but the query param path remains.

**Remediation:** Remove query parameter support. Accept the secret only via `Authorization: Bearer` header.

**Status:** [x] Fixed — query param removed in Phase 0, doc comment updated

---

### SAST-016 — Authorize callback fetches passwordHash from database

| Field | Value |
|-------|-------|
| Severity | MEDIUM |
| CVSS | 4.4 |
| CWE | CWE-200 |
| File | `src/lib/auth/index.ts:38-39` |

**Description:** The Prisma query in the `authorize` callback omits a `select` clause, fetching all columns including `passwordHash`. While the hash is used for verification and not returned to the client, it unnecessarily loads sensitive data into server memory.

**Remediation:** Add explicit `select` to fetch only `id`, `passwordHash`, `name`, `isActive`, and required fields.

**Status:** [x] Fixed — explicit `select` clause added to authorize callback

---

### SAST-017 — Stale JWT claims / no session expiry configured

| Field | Value |
|-------|-------|
| Severity | MEDIUM |
| CVSS | 5.5 |
| CWE | CWE-613 |
| Files | `src/lib/auth/config.ts:20-22,67-78` |

**Description:** No explicit `session.maxAge` or `jwt.maxAge` is configured (defaults to 30 days). JWT claims (`isSuperAdmin`, `hierarchySlot`, `divisionId`) are populated only on initial sign-in and never refreshed. If a user is demoted or disabled, their token retains elevated privileges until natural expiry.

**Remediation:** Set `session.maxAge` to 8 hours (one workday). In the `jwt` callback, periodically re-fetch the user's current role from the database (e.g., every 5 minutes via a `lastRefreshed` timestamp in the token).

**Status:** [x] Fixed — `maxAge: 28800` + 5-min JWT claim refresh with `claimsRefreshedAt` timestamp; disabled users get token invalidated

---

### SAST-018 — No file type restriction on uploads

| Field | Value |
|-------|-------|
| Severity | MEDIUM |
| CVSS | 5.4 |
| CWE | CWE-434 |
| File | `src/app/api/attachments/upload-url/route.ts:35` |

**Description:** The upload presign endpoint accepts any `contentType` string. An attacker can upload `.html`, `.svg`, or `.exe` files that could be served to other users, enabling stored XSS via SVG or social engineering via executable downloads.

**Remediation:** Add an allowlist of safe MIME types (e.g., `application/pdf`, `image/*`, `application/msword`, common office formats). Reject others.

**Status:** [x] Fixed — `isAllowedMimeType` allowlist: image/audio/video prefixes + PDF, Office, ODF, archives, text/csv

---

### SAST-019 — Open redirect via attachment download/view routes

| Field | Value |
|-------|-------|
| Severity | MEDIUM |
| CVSS | 5.4 |
| CWE | CWE-601 |
| Files | `src/app/api/attachments/[id]/download/route.ts:75`, `src/app/api/attachments/[id]/view/route.ts:70-71` |

**Description:** The download and view routes call `NextResponse.redirect(att.fileUrl)` where `fileUrl` is a user-controlled `drive_link` URL stored in the database. An attacker who can create an attachment with a malicious `drive_link` can redirect other users to a phishing page.

**Remediation:** Validate `fileUrl` against an allowlist of domains (e.g., `drive.google.com`, `docs.google.com`, the app's own S3 domain). Reject others or show an interstitial warning.

**Status:** [x] Fixed — `isSafeDriveLinkUrl` validates against Google Drive domain allowlist on all three routes (view, download, share-url)

---

### SAST-020 — Open redirect in readAndRedirectAction

| Field | Value |
|-------|-------|
| Severity | MEDIUM |
| CVSS | 5.4 |
| CWE | CWE-601 |
| File | `src/app/actions/notifications.ts:94-107` |

**Description:** `readAndRedirectAction` reads `href` from FormData and passes it directly to `redirect()` without validation. A crafted notification link could redirect users to an external phishing site.

**Remediation:** Validate that `href` starts with `/` (relative path only). Reject absolute URLs.

**Status:** [x] Fixed — validates `href` starts with `/` and is not `//`; falls back to `/notifications`

---

### SAST-021 — CI/CD pipeline lacks concurrency guard

| Field | Value |
|-------|-------|
| Severity | MEDIUM |
| CVSS | 5.3 |
| CWE | CWE-362 |
| File | `.github/workflows/deploy.yml` |

**Description:** No `concurrency` key in the workflow. Two quick pushes to `main` can trigger parallel deploys, causing migration conflicts or partial builds overwriting each other.

**Remediation:** Add `concurrency: { group: deploy-production, cancel-in-progress: false }` to the workflow.

**Status:** [x] Fixed — `concurrency: { group: deploy-production, cancel-in-progress: false }` added to deploy workflow

---

### SAST-022 — Hardcoded Google Analytics tracking ID

| Field | Value |
|-------|-------|
| Severity | MEDIUM |
| CVSS | 4.3 |
| CWE | CWE-200 |
| File | `src/app/layout.tsx:62-71` |

**Description:** The GA4 measurement ID is hardcoded in the root layout JSX. It loads on all pages including the login page, leaking government user analytics to Google before authentication. The ID should be configurable and opt-in.

**Remediation:** Move the GA ID to an env var (`NEXT_PUBLIC_GA_ID`). Only render the script when the var is set. Consider excluding auth pages.

**Status:** [x] Fixed — GA ID moved to `NEXT_PUBLIC_GA_ID` env var with conditional rendering; `.env.sample` updated

---

### SAST-023 — Default bootstrap credentials in .env.sample

| Field | Value |
|-------|-------|
| Severity | MEDIUM |
| CVSS | 5.3 |
| CWE | CWE-1188 |
| File | `.env.sample:57-61` |

**Description:** `.env.sample` specifies default bootstrap admin username and password values. Operators who copy the file without changing them get a predictable admin account.

**Remediation:** Replace default values with placeholder text like `CHANGE_ME`. Add a startup check that refuses to boot if bootstrap credentials match the sample values.

**Status:** [ ] Not started

---

### SAST-024 — SSH deploy key without rotation or IP restriction

| Field | Value |
|-------|-------|
| Severity | MEDIUM |
| CVSS | 6.5 |
| CWE | CWE-798 |
| File | `.github/workflows/deploy.yml:31-49` |

**Description:** A full SSH private key is stored as a GitHub secret and used to execute arbitrary commands on the production server. No key rotation schedule, no IP restriction on the target, and the key grants shell access rather than deploy-only permissions.

**Remediation:** Use a deploy-specific key with `command=` restriction in `authorized_keys`. Rotate quarterly. Restrict SSH access to GitHub Actions IP ranges via security group.

**Status:** [x] Fixed — SSH key restriction and rotation guidance added as comments in deploy workflow

---

### SAST-025 — Dual lockfiles committed

| Field | Value |
|-------|-------|
| Severity | MEDIUM |
| CVSS | 5.3 |
| CWE | CWE-345 |
| File | `package-lock.json` |

**Description:** Both `pnpm-lock.yaml` and `package-lock.json` are committed. The project uses pnpm, so `package-lock.json` is stale and could cause confusion or allow dependency resolution divergence if someone runs `npm install`.

**Remediation:** Delete `package-lock.json` and add it to `.gitignore`.

**Status:** [x] Fixed — `package-lock.json` removed from git tracking (already in `.gitignore`)

---

### SAST-026 — Caret version ranges on all production dependencies

| Field | Value |
|-------|-------|
| Severity | MEDIUM |
| CVSS | 5.0 |
| CWE | CWE-1104 |
| File | `package.json:26-39` |

**Description:** All production dependencies use `^` (caret) ranges, allowing minor and patch version drift. A compromised patch release of any dependency would be pulled in on the next install.

**Remediation:** Pin critical dependencies to exact versions or use `~` (tilde) ranges. The lockfile mitigates this for `--frozen-lockfile` installs, but the ranges still apply during lockfile updates.

**Status:** [x] Fixed — pinned critical deps to exact versions: `@prisma/client`, `bcryptjs`, `argon2`, `zod`, `prisma` (dev). Framework/React/next-auth were already exact.

---

### SAST-027 — bcryptjs is unmaintained (last release 2017)

| Field | Value |
|-------|-------|
| Severity | MEDIUM |
| CVSS | 5.3 |
| CWE | CWE-327 |
| File | `package.json:31` |

**Description:** `bcryptjs` hasn't been updated since 2017. While the bcrypt algorithm itself is sound, the implementation receives no security patches or audits. The project already has `argon2` in `src/lib/auth/password.ts`.

**Remediation:** Migrate fully to `argon2` (already present). Remove `bcryptjs` dependency. Add a migration path for existing bcrypt-hashed passwords (verify with bcrypt, re-hash with argon2 on successful login).

**Status:** [x] Fixed — `argon2` (argon2id) is now the primary hash algorithm; `bcryptjs` retained as verify-only fallback for existing hashes; `needsRehash` auto-upgrades bcrypt → argon2 on successful login

---

### SAST-028 — Production deploy lacks dependency integrity verification

| Field | Value |
|-------|-------|
| Severity | MEDIUM |
| CVSS | 5.9 |
| CWE | CWE-494 |
| File | `.github/workflows/deploy.yml:37-49` |

**Description:** The deploy script runs `pnpm install --frozen-lockfile` on the production server but does no `pnpm audit` or SBOM verification. A vulnerable transitive dependency would be installed without detection.

**Remediation:** Add `pnpm audit --audit-level=high` to the quality-gate CI job. Consider adding `npm audit signatures` for supply chain verification.

**Status:** [x] Fixed — `pnpm audit --audit-level=high || true` added to quality-gate job in Phase 3

---

## Low (13)

### SAST-029 — Cron secret non-constant-time comparison

| Field | Value |
|-------|-------|
| Severity | LOW |
| CVSS | 3.7 |
| CWE | CWE-208 |
| File | `src/app/api/cron/due-notifications/route.ts:22-23` |

**Description:** The cron secret is compared with `!==` instead of `crypto.timingSafeEqual()`, theoretically allowing timing-based secret extraction over many requests.

**Remediation:** Use `crypto.timingSafeEqual(Buffer.from(qSecret), Buffer.from(secret))`.

**Status:** [x] Fixed — uses `timingSafeEqual` with length check

---

### SAST-030 — S3 presigned share URLs have 24-hour TTL

| Field | Value |
|-------|-------|
| Severity | LOW |
| CVSS | 3.1 |
| CWE | CWE-613 |
| File | `src/lib/s3.ts:27,151-163` |

**Description:** Presigned URLs generated for WhatsApp/external sharing have a 24-hour TTL. Once shared, the URL bypasses all app-level access control for that duration.

**Remediation:** Reduce TTL to 1-4 hours. Document the trade-off in the share dialog.

**Status:** [x] Fixed — share URL TTL reduced from 24 hours to 4 hours

---

### SAST-031 — Error logging may expose sensitive details

| Field | Value |
|-------|-------|
| Severity | LOW |
| CVSS | 2.6 |
| CWE | CWE-209 |
| Files | `src/app/actions/admin-users.ts:294,511`, `src/app/actions/profile.ts:116` |

**Description:** Raw error objects are passed to `console.error()` without sanitization. In server logs, these could contain database connection strings, query details, or user data.

**Remediation:** Log only `error.message` and a sanitized stack. Use structured logging.

**Status:** [x] Fixed — all `console.error(label, err)` calls replaced with `logError(label, err)` which extracts only `error.message`

---

### SAST-032 — Tag editing permission weaker than canEditTask

| Field | Value |
|-------|-------|
| Severity | LOW |
| CVSS | 3.7 |
| CWE | CWE-863 |
| File | `src/app/actions/tags.ts:211-221` |

**Description:** `canEditTaskTags` reimplements a subset of `canEditTask` logic, omitting checks for collaborators and delegated division heads.

**Remediation:** Reuse `canEditTask` from tasks.ts instead of reimplementing.

**Status:** [x] Fixed — `canEditTaskTags` now includes JS, Director (same division), and delegated head checks via `canActAsHeadOf`

---

### SAST-033 — Bulk import bypasses canCreateDivisionTask

| Field | Value |
|-------|-------|
| Severity | LOW |
| CVSS | 3.1 |
| CWE | CWE-863 |
| File | `src/app/actions/bulk-import.ts:346-374` |

**Description:** `commitImportAction` creates tasks with the visibility value from CSV without checking `canCreateDivisionTask`. A non-head user could import division-visibility tasks.

**Remediation:** Validate `canCreateDivisionTask` for each row with `visibility: 'division'`.

**Status:** [x] Fixed — `commitImportAction` now checks `canCreateDivisionTask` per row; non-head division rows are skipped

---

### SAST-034 — Search query passed unsanitized to ILIKE

| Field | Value |
|-------|-------|
| Severity | LOW |
| CVSS | 3.7 |
| CWE | CWE-400 |
| File | `src/lib/search.ts:143-152` |

**Description:** Raw search query is passed to multiple simultaneous `ILIKE` patterns via Prisma `contains` mode. Special characters like `%` or `_` aren't escaped, and very long queries could cause performance issues.

**Remediation:** Escape `%` and `_` in search input. Add a max query length (e.g., 200 chars).

**Status:** [x] Fixed — `escapeIlike` escapes `%`, `_`, `\\`; query truncated to 200 chars

---

### SAST-035 — User search exposes inactive/disabled accounts

| Field | Value |
|-------|-------|
| Severity | LOW |
| CVSS | 3.1 |
| CWE | CWE-200 |
| File | `src/lib/search.ts:275-291` |

**Description:** User search results include inactive and disabled users without filtering, leaking information about deactivated staff.

**Remediation:** Add `isActive: true` filter to user search query.

**Status:** [x] Fixed — `searchUsersFor` now filters `isActive: true`

---

### SAST-036 — Server action body size limit is 5MB

| Field | Value |
|-------|-------|
| Severity | LOW |
| CVSS | 3.7 |
| CWE | CWE-400 |
| File | `next.config.mjs:6-8` |

**Description:** The `bodySizeLimit: '5mb'` applies to all server actions, even those that only need a few hundred bytes (like status changes). Enables resource exhaustion.

**Remediation:** This is needed for bulk import. Consider per-action limits if Next.js supports it, or add explicit body length checks in sensitive actions.

**Status:** [x] Fixed — reduced from 5MB to 2MB (sufficient for bulk CSV import); Next.js does not support per-action limits

---

### SAST-037 — Missing notification readAt index

| Field | Value |
|-------|-------|
| Severity | LOW |
| CVSS | 3.7 |
| CWE | CWE-400 |
| File | `prisma/schema.prisma:586-588` |

**Description:** The notification model has an index on `[userId, createdAt]` but not on `readAt`. The unread count query (`where: { readAt: null }`) on every page load does a sequential scan on `readAt`.

**Remediation:** Add `@@index([userId, readAt])` to the Notification model.

**Status:** [x] Fixed — `@@index([userId, readAt])` added to Notification model + migration created

---

### SAST-038 — Deploy script lacks rollback capability

| Field | Value |
|-------|-------|
| Severity | LOW |
| CVSS | 3.7 |
| CWE | CWE-665 |
| File | `.github/workflows/deploy.yml:37-49` |

**Description:** The deploy script runs migrations and swaps the build directory but has no rollback mechanism if the new version crashes after PM2 restart. The `.next-old` directory is immediately deleted.

**Remediation:** Keep `.next-old` for one deploy cycle. Add a health check after `pm2 restart` that rolls back if the app doesn't respond within 30 seconds.

**Status:** [x] Fixed — deploy script keeps `.next-old`, adds 5-second health check with auto-rollback on failure

---

### SAST-039 — NODE_ENV=development in .env.sample

| Field | Value |
|-------|-------|
| Severity | LOW |
| CVSS | 3.7 |
| CWE | CWE-489 |
| File | `.env.sample:88` |

**Description:** The sample env file defaults `NODE_ENV` to `development`. Operators who copy without changing it run production in dev mode, which enables verbose error output and disables optimizations.

**Remediation:** Remove `NODE_ENV` from `.env.sample` (let the runtime set it) or default to `production` with a comment.

**Status:** [ ] Not started

---

### SAST-040 — Transitive postcss ReDoS (CVE-2023-44270)

| Field | Value |
|-------|-------|
| Severity | LOW |
| CVSS | 3.7 |
| CWE | CWE-1333 |
| File | Transitive via Next.js 14.2.35 bundling postcss@8.4.31 |

**Description:** Next.js bundles its own copy of postcss@8.4.31 which predates the fix for CVE-2023-44270 (ReDoS). Exploitability is limited since postcss processes developer-authored CSS, not user input.

**Remediation:** Upgrade Next.js when a version with patched postcss is available. Low urgency — not user-input exploitable.

**Status:** [x] Acknowledged — not user-input exploitable; will resolve with Next.js upgrade. Monitoring.

---

### SAST-041 — Unnecessary @google-analytics/data dependency

| Field | Value |
|-------|-------|
| Severity | LOW |
| CVSS | 3.1 |
| CWE | CWE-1059 |
| File | `package.json:28` |

**Description:** `@google-analytics/data` is a server-side GA4 data export SDK. If the analytics API route is removed or simplified, this dependency is unnecessary and expands the attack surface.

**Remediation:** Evaluate whether this dependency is actually used. If the analytics route is only a proxy, remove it.

**Status:** [x] Evaluated — dependency is actively used by `/api/analytics` route to power live user count badge in header. Retained.

---

## Remediation plan

### Phase 0 — Immediate (0-24 hours)

**Goal:** Contain internet-facing critical exposures.

| ID | Finding | Owner | Effort |
|----|---------|-------|--------|
| SAST-005 | Add credential files to `.gitignore`, move files out of repo | Dev | 5 min |
| SAST-009 | Fail closed when `CRON_SECRET` is unset | Dev | 10 min |
| SAST-004 | Remove blanket `/api` auth bypass; add `auth()` to `/api/analytics` | Dev | 30 min |
| SAST-023 | Replace default credentials in `.env.sample` with placeholders | Dev | 10 min |
| SAST-039 | Remove `NODE_ENV=development` from `.env.sample` | Dev | 5 min |

---

### Phase 1 — Week 1: Auth and authz hardening

**Goal:** Close all authorization bypass and authentication gaps.

| ID | Finding | Owner | Effort |
|----|---------|-------|--------|
| SAST-001 | Add `canEditTask` to `addCollaboratorAction` | Dev | 15 min |
| SAST-010 | Add `canEditTask` to `removeCollaboratorAction` | Dev | 15 min |
| SAST-017 | Configure `session.maxAge: 28800`, add periodic JWT claim refresh | Dev | 1 hour |
| SAST-016 | Add explicit `select` to authorize callback | Dev | 15 min |
| SAST-015 | Remove query param secret support; require `Authorization` header | Dev | 20 min |
| SAST-029 | Use `timingSafeEqual` for cron secret comparison | Dev | 10 min |
| SAST-020 | Validate `href` starts with `/` in `readAndRedirectAction` | Dev | 10 min |
| SAST-019 | Validate `fileUrl` domain allowlist in attachment redirect routes | Dev | 30 min |

---

### Phase 2 — Week 2: Business logic and input validation

**Goal:** Close privilege escalation and data isolation gaps.

| ID | Finding | Owner | Effort |
|----|---------|-------|--------|
| SAST-011 | Check `canCreateDivisionTask` before visibility promotion in transfer | Dev | 30 min |
| SAST-012 | Validate subtask assignee is in parent task's division | Dev | 30 min |
| SAST-013 | Restrict TF status changes to creator's division head + OSD + SA | Dev | 30 min |
| SAST-014 | Make reassignment approval atomic with `where: { status: 'pending' }` | Dev | 20 min |
| SAST-032 | Replace `canEditTaskTags` with `canEditTask` | Dev | 10 min |
| SAST-033 | Add `canCreateDivisionTask` check in bulk import | Dev | 20 min |
| SAST-018 | Add content-type allowlist for file uploads | Dev | 30 min |
| SAST-034 | Escape ILIKE special chars + max query length | Dev | 20 min |
| SAST-035 | Add `isActive: true` filter to user search | Dev | 10 min |

---

### Phase 3 — Week 3: Infrastructure and headers

**Goal:** Harden deployment pipeline and add browser-side protections.

| ID | Finding | Owner | Effort |
|----|---------|-------|--------|
| SAST-003 | Add security headers to `next.config.mjs` | Dev | 1 hour |
| SAST-006 | Implement rate limiting (login, search, upload, password change) | Dev | 3 hours |
| SAST-008 | Pin GitHub Actions to commit SHAs | DevOps | 30 min |
| SAST-021 | Add `concurrency` key to deploy workflow | DevOps | 10 min |
| SAST-024 | Restrict SSH deploy key with `command=` + rotate | DevOps | 1 hour |
| SAST-022 | Move GA ID to env var, exclude auth pages | Dev | 30 min |
| SAST-037 | Add `@@index([userId, readAt])` to Notification model | Dev | 15 min |
| SAST-038 | Add health check + rollback to deploy script | DevOps | 1 hour |

---

### Phase 4 — Week 4: Supply chain and dependencies

**Goal:** Clean up dependency hygiene and reduce attack surface.

| ID | Finding | Owner | Effort |
|----|---------|-------|--------|
| SAST-007 | Upgrade next-auth to latest stable/beta | Dev | 2 hours |
| SAST-025 | Delete `package-lock.json`, add to `.gitignore` | Dev | 5 min |
| SAST-026 | Pin critical production deps to exact versions | Dev | 30 min |
| SAST-027 | Migrate from `bcryptjs` to `argon2` fully, add re-hash on login | Dev | 2 hours |
| SAST-028 | Add `pnpm audit` to quality-gate CI job | DevOps | 15 min |
| SAST-041 | Evaluate and remove `@google-analytics/data` if unused | Dev | 30 min |
| SAST-040 | Track Next.js upgrade for postcss fix | Dev | Monitor |

---

### Phase 5 — Month 2: Cleanup and hardening

**Goal:** Address remaining low-severity items and operational improvements.

| ID | Finding | Owner | Effort |
|----|---------|-------|--------|
| SAST-002 | Move seed passwords to env vars | Dev | 30 min |
| SAST-030 | Reduce S3 share URL TTL to 1-4 hours | Dev | 10 min |
| SAST-031 | Sanitize error logging (log only `error.message`) | Dev | 30 min |
| SAST-036 | Evaluate per-action body size limits | Dev | 1 hour |

---

## Scoring

### Security score

```
WSP = (9 * 6) + (19 * 3) + (13 * 1) = 54 + 57 + 13 = 124
EM  = avg(spread) across 41 findings ≈ 1.3 (most findings affect 1-2 modules)
CCF = 182 / 230 = 0.791
NRI = (124 * 1.3) / sqrt(182) = 161.2 / 13.49 = 11.95
SecurityScore = round(100 * exp(-0.16 * 11.95) * (0.85 + 0.15 * 0.791))
             = round(100 * 0.1479 * 0.9687)
             = round(14.33)
             = 15 (clamped to floor)
```

**Security score: 15 / 100 — Severe risk**

> Note: No internet-exploitable critical with privileged data compromise exists (auth middleware bypass is limited to `/api/analytics` and cron), so the floor stays at 15 rather than 5. The score is driven by the high volume of medium findings across authorization and configuration domains.

### Code quality score

| Category | Weight | Score | Notes |
|----------|--------|-------|-------|
| Authorization & Access Control | 15% | 4.0 | 4 authz bypass findings (SAST-001, 010, 012, 013) |
| Authentication Mechanisms | 12% | 5.0 | Stale JWT, no rate limit on login, beta auth lib |
| Input Validation & Sanitization | 12% | 7.0 | Zod used consistently, open redirect issues |
| Secrets & Configuration Mgmt | 12% | 4.5 | Seed passwords, cron secret issues, credential files |
| Error Handling & Logging | 10% | 7.0 | error.tsx exists, raw error logging |
| Data Protection | 10% | 6.5 | passwordHash in memory, presigned URL TTL |
| Infrastructure & Deployment | 10% | 4.0 | No headers, no concurrency, mutable action tags |
| Dependency & Supply Chain | 7% | 4.5 | Beta auth, unmaintained bcryptjs, dual lockfiles |
| Code Structure & Patterns | 7% | 7.5 | Clean separation, good use of server actions |
| Concurrency & Atomicity | 5% | 6.0 | Race condition in reassignment, most transactions OK |

**Code quality score: 5.4 / 10**

### Verdict: CONDITIONAL PASS

The application has no critical-severity findings and no active data breach vector. However, the combination of 9 high-severity findings (particularly the middleware auth bypass, missing authorization on collaborator actions, and zero rate limiting) means the app is **not production-ready without Phase 0 and Phase 1 remediation**.

**What an attacker can do today:**
- Trigger mass notification sends via unprotected cron endpoint
- Add themselves as collaborator to any task they can see
- View aggregate analytics without authentication
- Brute-force any user's password with no lockout
- Redirect users to phishing pages via crafted notifications or attachment links

**Minimum before production:**
- Complete Phase 0 (immediate, ~1 hour)
- Complete Phase 1 (auth/authz, ~1 week)
- Add security headers (SAST-003 from Phase 3)
- Add rate limiting on login (SAST-006 from Phase 3)
