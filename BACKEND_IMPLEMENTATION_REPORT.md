# Scheme Sathi — Backend Implementation Report

Complete technical specification of the Scheme Sathi backend, based on a full source
audit of this repository (212 TS files, ~28k lines). Use this document to understand,
operate, or re-implement the backend on any stack with identical behaviour.

---

## 1. Product Summary

Scheme Sathi is a bilingual (English/Hindi) Indian government-scheme and scholarship
finder. Users answer a short profile (age, state, caste, income, occupation, gender,
student/farmer/disability flags), receive explainable match scores against a reviewed
scheme catalog, and can then track applications, upload scheme documents, run AI OCR
extraction, assign family reviewers, receive deadline reminders, and export history.
Administrators manage the catalog, OCR policy, and college/NGO pilot cohorts with
conversion analytics.

**Core design principles found in source:**
- Deterministic, explainable matching (no AI in scoring; AI only in OCR and help chat).
- Privacy-minimal: no Aadhaar/bank numbers stored; documents are private with explicit
  reviewer grants; cohort analytics are anonymous hashes.
- Every state change writes an immutable audit/activity event.
- Server is the single source of truth for the catalog; the client derives its offline
  fallback from the same shared module.

---

## 2. Technology Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (ESM), Express 4 |
| API framework | tRPC v11 (Express adapter) + superjson transformer |
| ORM | Drizzle ORM (mysql-core), drizzle-kit for migrations |
| Database | MySQL (29 tables, see §4) |
| Auth | Platform OAuth (authorization-code) → signed JWT session cookie (jose, HS256) |
| Storage | S3 via platform presigned PUT/GET (server proxy at `/app-storage/*`) |
| AI | Platform `invokeLLM` (vision-capable, JSON-schema responses) for OCR; `streamLLM` (SSE) for help chat |
| Scheduling | Platform Heartbeat HTTP-cron service (6-field UTC cron, min interval 60s) |
| Validation | Zod on every tRPC input; custom validators for uploads |
| Rate limiting | In-memory sliding windows per IP (10-min windows) |
| PDF / CSV | pdf-lib for PDF export; hand-rolled CSV quoting (formula-safe) |
| Tests | Vitest — 38 files / 149 tests (server domain logic + client parity guards) |
| Build | Vite (client) + esbuild (server bundle) |

---

## 3. Runtime Architecture

```
Browser (React SPA / PWA)
   │  static assets + SPA fallback
   │  /api/trpc/*          → tRPC appRouter (createContext: optional user)
   │  /api/oauth/callback  → OAuth code exchange → session cookie
   │  /api/help/stream     → SSE AI help chat (rate-limited)
   │  /app-storage/*     → 307 redirect to presigned S3 GET (private docs)
   └─ /api/scheduled/*     → cron callbacks (Heartbeat-auth only)
        ├─ application-reminder        one-time deadline reminder
        ├─ document-review-due-reminder reviewer due-date reminder
        └─ document-expiry-reminders  daily 03:00 UTC document-expiry scan

Server entry (server/_core/index.ts)
  express.json({limit:50mb}) → storageProxy → oauthRoutes → scheduled handlers
  → schemeHelpRoutes → tRPC middleware → (dev: Vite middleware | prod: static dist)

Platform dependencies (platform API, keyed by PLATFORM_API_KEY):
  • OAuth:  webdev.v1.WebDevAuthPublicService (ExchangeToken/GetUserInfo)
  • Heartbeat: webdevtoken.v1.WebDevService (Create/Update/Delete/ListHeartbeatJob)
  • Storage: v1/storage/presign/put | v1/storage/presign/get
  • LLM:    invokeLLM / streamLLM helpers (server/_core/llm.ts)
  • Data APIs: webdevtoken.v1.WebDevService/CallApi (generic; unused by domain logic)
```

**Server bootstrap details:**
- Body limit 50 MB (documents travel as base64 inside tRPC JSON, max 8 MB per file).
- Port: `PORT` env or 3000; scans up to 20 ports if busy (dev convenience).
- Dev mode attaches Vite middleware; production serves `dist/public` with SPA fallback.

---

## 4. Data Model (MySQL — drizzle/schema.ts)

### 4.1 Identity & profile
| Table | Purpose / notable columns |
|---|---|
| `users` | `openId` (unique, OAuth subject), name, email, `loginMethod`, `role` enum(`user`,`admin`), `lastSignedIn`. |
| `user_scheme_profiles` | 1:1 with users. Matching profile: age, state, caste, annualIncome, occupation, gender, isStudent/isFarmer/isDisabled. Unique on userId. |

### 4.2 Catalog & engagement
| Table | Purpose |
|---|---|
| `scheme_catalog` | Bilingual scheme rows. JSON columns: `eligibility` (EligibilityRule), `documents`, `steps` (+Hindi variants). `verificationStatus` enum(officialDirectory, eligibilityVerified), `reviewed` (review note), `applicationDeadline` + `deadlineLabel`. Indexes on category, level. |
| `saved_schemes` | User↔scheme bookmark. Unique (userId, schemeId). |
| `scheme_notes` | One owner-private note per saved scheme. Unique (userId, schemeId). |
| `comparison_export_presets` | Named field-set presets for CSV/PDF scheme comparison. Unique (userId, name). |

### 4.3 Application tracking
| Table | Purpose |
|---|---|
| `tracked_applications` | One row per user per scheme. `status` enum(considering, preparing, submitted, approved, rejected, closed); applicationReference, deadline, notes. Unique (userId, schemeId). |
| `application_reminders` | Per tracked application: `remindAt`, `status` enum(scheduled, delivered, cancelled, failed), `scheduleCronTaskUid` (unique) — the Heartbeat task that fires it. |
| `application_documents` | Uploads mapped 1:1 to the scheme's checklist item name. storageKey/storageUrl, fileName, mimeType, `expiresAt`, OCR state (`ocrStatus` enum(notRequested, processing, complete, failed), `ocrExtraction` JSON, `ocrError`, `ocrVerifiedAt`, `userVerifiedAt`), `reviewState` enum(unreviewed, reviewed, flagged). Unique (trackedApplicationId, documentName). |
| `document_activity_events` | Immutable user-facing history: uploaded/reuploaded/expiryUpdated/ocrStarted/ocrCompleted/ocrFailed/userVerified/reviewed/flagged. |

### 4.4 Reviewer collaboration
| Table | Purpose |
|---|---|
| `document_review_assignments` | Owner grants an existing account access to ONE document. status enum(assigned, inReview, completed, revoked); dueAt/reminderAt + reminderStatus + reminderScheduleCronTaskUid; snooze (until/count); escalationState enum(normal, escalated, resolved) + note. Unique (applicationDocumentId, reviewerUserId). |
| `document_reviewer_alert_preferences` | Per-user: assignmentAlertsEnabled, dueDateRemindersEnabled, defaultReminderLeadHours (1–168), maxActiveAssignments (1–50). Enforced during assignment. |
| `document_review_escalation_templates` | Owner-private reusable follow-up message templates (name, body ≤500). |
| `document_review_assignment_notifications` | In-app alerts for the reviewer: kind enum(assignment, dueDateReminder), read/unread. Unique (assignmentId, kind). |
| `document_review_audit_events` | Immutable accountability trail: assigned/started/completed/revoked/noteCreated/noteUpdated/noteDeleted/dueReminderSent/reminderSnoozed/escalated/escalationResolved + actorUserId. |
| `document_pdf_annotations` | Page-scoped notes visible only to their author. Removed with document (cascade). |

### 4.5 Verification history & family sharing
| Table | Purpose |
|---|---|
| `saved_verification_history_filters` | Named presets for date/order/keyword search over document history. `sort` enum(newest, oldest), isDefault. Unique (userId, name). |
| `saved_verification_history_filter_shares` | Owner→recipient sharing. status enum(pending, accepted, declined) — recipient must accept an invite. Unique (savedFilterId, recipientUserId). |
| `family_filter_invitation_notifications` | Unread/read in-app invite alerts for the recipient. Unique per share. |

### 4.6 OCR analytics & policy
| Table | Purpose |
|---|---|
| `document_ocr_confidence_events` | Append-only confidence snapshot (low/medium/high + concernCount) written on every successful OCR. Feeds the confidence trend chart. |
| `ocr_policy_settings` | Singleton row (`id='global'`): `minimumConfidence` enum(low, medium, high) — anything below it (or any concern) forces manual review. `updatedByUserId` tracks the admin. |

### 4.7 Document expiry automation
| Table | Purpose |
|---|---|
| `document_expiry_notifications` | Deduped per-document alerts: kind enum(expiringSoon, expired), unread/read. Unique (documentId, kind). |
| `document_reminder_settings` | Singleton automation owner row: `scheduleCronTaskUid` of the daily Heartbeat scan + lastRunAt. |

### 4.8 Pilot / growth
| Table | Purpose |
|---|---|
| `pilot_cohort_invites` | Admin-created revocable codes for college/NGO outreach: cohortType enum(college, ngo), code (unique, 8–32 chars), maxUses, usedCount, expiresAt, revokedAt. |
| `pilot_cohort_visits` | Anonymous visit markers — stores SHA-256 `visitorHash` of a browser token, never the raw token. Unique (cohortInviteId, visitorHash). |
| `pilot_cohort_signups` | First-touch attribution: one row per user (unique userId) linking signup → cohort. |
| `pilot_feedback_submissions` | Public anonymous interview feedback: role/journeyStage enums, biggestBlocker/helpfulToday, optional contactEmail only with consent; admin status workflow (new/reviewed/followUp/archived) + adminNote. |
| `pilot_dashboard_views` | Admin-private saved dashboard filter views: from/to dates, segment(all/college/ngo), view(month/quarter); pinning + rank, folders + colors, archive/restore. Unique (userId, name). |
| `pilot_dashboard_archive_settings` | Per-admin retention preference (15/30/60 days). |

**Cross-cutting schema conventions:** all timestamps are `defaultNow()/onUpdateNow()`;
all user-owned rows cascade-delete with the user; every share/assignment/reminder
pair has a unique index that encodes the business rule (one row per relationship).

---

## 5. API Surface

### 5.1 tRPC procedures (all under `POST/GET /api/trpc/<router>.<procedure>`)

Auth levels: **[P]** public · **[U]** protected (session) · **[A]** admin-only.

**system** (systemRouter): health/version probe. **[P]**

**auth**
- `me` **[P]** — returns current user or null.
- `logout` **[P]** — clears session cookie.

**schemes**
- `list` **[P]** — filters: category, level(Central/State), state, deadline(announced/closingSoon/openEnded), administeringBody, verificationStatus, sort(name/category/deadline/reviewed/provider), query ≤120. Server-side filtering incl. 90-day closingSoon window.
- `filterOptions` **[P]** — distinct administering bodies for filter UI.
- `byId` **[P]** — single scheme with fallback null.

**matching**
- `run` **[P]** — full profile → ranked matches (§8 algorithm). Response includes `generatedAt`.

**scholarships**
- `checkEligibility` **[P]** — reduced profile (age 10–45, state, caste, income, gender, isDisabled) → education-only matches + fixed disclaimer text. Server forces `isStudent:true, occupation:"Student"`.

**pilot**
- `cohort` **[P]** — resolve a public invite code (active, unexpired, under maxUses).
- `trackCohortVisit` **[P]** — code + UUID visitorToken → hashed visit marker (rate-unbounded but idempotent per hash).
- `recordCohortSignup` **[U]** — first-touch attribution, idempotent.
- `submitFeedback` **[P]** — rate-limited 5/10min/IP; consent refinement rules enforced in Zod.

**profile** — `mine` **[U]**, `save` **[U]** (upsert, full Zod profile with 0–120 age, income ≤10^8).

**saved** — `list` **[U]** (scheme ids), `notes` **[U]** (optional keyword query), `toggle` **[U]** (validates scheme exists), `getNote`/`upsertNote`/`deleteNote` **[U]** (note ≤4000 chars).

**comparisonExports** — `listPresets`/`savePreset`/`deletePreset` **[U]**; fields enum(matchScore, benefit, eligibility, documents, steps, officialPortal), unique-field refinement, ≤6 fields.

**applications** — `list` **[U]** (joins OCR policy for UI), `track` **[U]** (idempotent per user+scheme), `update` **[U]** (status/reference/deadline/notes patch).

**reminders**
- `create` **[U]** — validates remindAt > now+60s; creates DB row; registers Heartbeat cron (§7.1); on any failure compensates by cancelling the DB row.
- `cancel` **[U]** — cancels DB row + deletes the Heartbeat job (best-effort).

**documents** (all **[U]** unless noted)
- `upload` — base64 ≤8MB, mime ∈ {pdf, jpeg, png}; documentName must be in the scheme's checklist; storage path `applications/{userId}/{trackedApplicationId}/{safeFileName}_{rand8}.{ext}`; upsert per checklist item resets OCR state.
- `remove`, `updateExpiry`, `preview` (returns presigned GET URL), `extract` (runs OCR, §9), `approveOcr` (marks user-verified), `setReviewState` (reviewed/flagged/unreviewed).
- `batchExtract` (≤5 ids, deduped), `batchApproveOcr` (≤10 ids).
- `history` — timeline filters (startAt/endAt/sort/query with start≤end refinement).
- `exportHistoryPdf` / `exportHistoryCsv` — private history exports honoring the same filters.
- `notifications` / `markNotificationRead` — document expiry alerts.
- **documents.reviewers**: `list`, `assign` (by reviewer email; enforces capacity + preferences + self-assign ban), `revoke` (also deletes due-reminder cron), `mine`, `updateMine` (inReview/completed), `audit` (status-filtered), `notifications`, `markNotificationRead`, **preferences.get/save**, **dueDates.set** (dueAt/reminderAt with reminder<due and >now+60s; registers cron only in production — dev defers), **dueDates.cancel**, `workload` (reviewer load stats), `overdue` (owner view), `escalation` (escalate/resolve + note), **escalationTemplates.list/save/remove**, `snooze` (>now+60s; reschedules cron).
- **documents.annotations**: `list`, `save` (pageNumber ≤2000, note ≤4000, upsert), `remove`.
- **documents.historyFilters**: `list` (own + shares + received + invites in one call), `save`, `remove`, `setDefault` (nullable → clears), `share` (by recipient email, existing account required), `revokeShare`, `respondToInvite` (accepted/declined), `notifications`, `markNotificationRead`.

**admin**
- **schemes.list** **[A]**, **schemes.update** **[A]** (name/bilingual fields/portalUrl/deadline/reviewed patch; URL-validated portal).
- **documentAutomation.status/enable** **[A]** — registers the daily `0 0 3 * * *` expiry-scan cron; idempotent (skips if taskUid already stored).
- **ocrPolicy.get/update** **[A]** — singleton minimumConfidence.
- **pilot.feedback.list/update** **[A]** — status workflow + adminNote.
- **pilot.cohorts.** `list`, `conversionStats` (visits vs signups per cohort with date/type filters), `monthlyTrend` (month/quarter buckets), `create` (maxUses 1–500, optional expiry > now+60s), `revoke` — all **[A]**.
- **pilot.views.** 15 procedures **[A]**: list, archiveSettings/set, save, setPinned, reorderPinned (≤20), renameFolder, moveToFolder, setFolderColor, deleteFolder, setArchived, restoreArchived, importArchived (≤20), duplicate, delete.

> Procedure count: ~85. Every mutation input is Zod-validated; date refinements
> (start≤end, reminder<due, future+60s) are expressed as Zod refinements so the
> client and server share the same rules.

### 5.2 Plain REST endpoints
| Method & Path | Auth | Purpose |
|---|---|---|
| GET `/api/oauth/callback` | public + state nonce | OAuth code→token→userInfo→upsert user→issue session JWT cookie. 403 on nonce mismatch. |
| GET `/app-storage/*` | public path, unguessable keys | 307 redirect to presigned S3 GET via the platform. `Cache-Control: no-store`. |
| POST `/api/scheduled/application-reminder` | Heartbeat cron only | Marks reminder delivered; disables its own cron (one-shot semantics on a cron service). |
| POST `/api/scheduled/document-review-due-reminder` | Heartbeat cron only | Delivers reviewer due-date alert notification; disables cron. |
| POST `/api/scheduled/document-expiry-reminders` | Heartbeat cron only | Daily scan: creates expiringSoon (≤30d) / expired notifications; records lastRunAt. |
| POST `/api/help/stream` | public, rate-limited 12/10min/IP | SSE stream from `streamLLM` (claude-haiku-4-5, 900 max tokens). Input validated ≤800 chars. Abort propagation on client disconnect. |

### 5.3 Cron-auth model (important)
Scheduled handlers call `sdk.authenticateRequest(req)` and require `isCron &&
taskUid`. The taskUid is then matched against a durable DB row
(`application_reminders.scheduleCronTaskUid`, `document_reminder_settings`,
`getDocumentReviewDueReminderByTaskUid`). **No request body data is ever trusted**
for identifying what to deliver — the cron task UID is the only lookup key.

---

## 6. Authentication & Sessions

1. **Login start (client):** `startLogin()` mints a one-time nonce, writes it into
   the `__Host-oauth_state` cookie (host-only, Secure, Path=/ — prevents sibling
   subdomain CSRF), and redirects to the platform OAuth authorize URL with
   `state = base64({redirectUri, nonce})`.
2. **Callback (server):** validates `state.nonce === cookie nonce` (403 on fail,
   malformed base64 decodes to empty nonce → rejected), clears the nonce cookie,
   exchanges `code` via `ExchangeToken`, fetches identity via `GetUserInfo`,
   upserts the user row keyed by `openId`, signs an HS256 JWT
   (`{openId, appId, name}`, 1-year) with `JWT_SECRET`, sets it as the
   `app_session_id` cookie.
3. **Every request:** `createContext` runs `sdk.authenticateRequest` — verifies the
   JWT, resolves the user from DB (falls back to `OWNER_OPEN_ID` as owner identity).
   Failures are swallowed → `user: null` (public procedures still work).
4. **Roles:** `users.role` ∈ {user, admin}. `protectedProcedure` requires a user;
   `adminProcedure` requires `role==='admin'` (FORBIDDEN otherwise).
5. **Heartbeat identity:** cron registration requires the *decoded session token*
   (passed via `x-app-user-session` header) so jobs are owned by the acting user;
   empty string falls back to the project owner.

---

## 7. Scheduled Automation

### 7.1 One-time reminders on a cron-only service
`buildReminderCron(ms)` renders `0 MIN HOUR DOM MON *` (UTC, seconds=0) — a
yearly-cron that fires once at the target instant. After first delivery the handler
calls `updateHeartbeatJob(taskUid, {enable:false})` so the reminder stays one-time.
Compensating deletes are `.catch(() => undefined)` where a stale cron is tolerable.

### 7.2 Registered jobs
| Job | Cron (UTC) | Created by |
|---|---|---|
| `scheme-sathi-reminder-…` | per-reminder one-shot | `reminders.create` |
| `scheme-sathi-review-due-…` / `…-snooze-…` | per-assignment one-shot | `documents.reviewers.dueDates.set` / `snooze` (production only; dev returns `{deferred:true}`) |
| `scheme-sathi-document-expiry-daily` | `0 0 3 * * *` | `admin.documentAutomation.enable` |

### 7.3 Expiry scan logic (`scanDocumentExpiryNotifications`)
Selects application documents with `expiresAt` set, joined to their owners.
For each: ≤30 days → upsert `expiringSoon` notification; past → upsert `expired`.
Upserts are deduped by the unique (documentId, kind) index; user-visible read state
survives rescans.

---

## 8. Scheme Matching Algorithm (deterministic, mirrored client↔server)

**Eligibility rule shape** (`shared/schemeCatalog.ts`): optional `ageMin/ageMax`,
`incomeMax`, `casteCategories[]|"all"`, `occupations[]|"all"`, `states[]|"all"`,
`genders[]|"all"`, `requiresStudent/requiresFarmer/requiresDisability`.

**Hard filter (`meetsRequiredEligibility`)** — a scheme is excluded unless every
present rule matches: age range, income ceiling, caste, occupation (farmer flag
counts as "Agriculture"), state, gender, student/farmer/disability requirements.

**Scoring (`scoreScheme`)** — additive points per matched factor, capped at 100:

| Factor | Points |
|---|---|
| work/occupation | 22 |
| caste category | 18 |
| age | 15 |
| income | 15 |
| state | 12 |
| gender | 8 |
| student | 4 |
| farmer | 3 |
| disability | 3 |

**Ranking (`rankSchemes`):** filter by hard eligibility → score → keep score ≥45 →
sort by score desc, name asc. **Scholarship variant:** restricts to
`category==="Education" || requiresStudent`, forces `isStudent/occupation="Student"`.

**Parity invariant:** the client's offline scorer (`client/src/lib/schemes.ts`)
must produce identical scores/factors. Enforced by
`server/clientServerConsistency.test.ts` across 4 diverse profiles × every
catalog scheme, plus a state-list coverage check (every state named in any
catalog `states[]` rule must appear in the client's `states` export).

**Catalog seeding (`ensureSchemeCatalog`):** idempotent — on every first catalog
read, upserts all `shared/schemeCatalog.ts` rows (`onDuplicateKeyUpdate` only
touches `updatedAt`; admin edits are never clobbered) then pins the NSP row's
announced deadline. Entries: 13 hand-reviewed flagship schemes + 31 NSP-directory
scholarships (Education/Central, `verificationStatus: officialDirectory`, generic
"read the official specification" copy — deliberately no invented benefit amounts).

---

## 9. Document & OCR Pipeline

1. **Upload** — base64 → validated (≤5MB decoded, pdf/jpeg/png, sanitized
   filename) → `storagePut` to S3 (key gets 8-hex random suffix → unguessable) →
   DB upsert per (application, checklist item) → activity event `uploaded|reuploaded`.
2. **Extract** (`runApplicationDocumentOcr`) — sets `ocrStatus=processing`,
   activity `ocrStarted`; fetches presigned GET URL; calls `invokeLLM` with
   model `gemini-3-flash-preview`, strict JSON schema
   (`documentType, detectedName, referenceNumbers[≤8], dates[≤8], keyDetails[≤8],
   concerns[≤6], confidence∈{low,medium,high}`), system prompt forbids inference,
   legal-validity claims, and asks for concerns+low confidence when unreadable;
   PDFs sent as `file_url`, images as `image_url` (detail:high). Response is
   length-normalized, stored as `ocrExtraction`, activity `ocrCompleted`,
   confidence event appended. Failure → `ocrError` + activity `ocrFailed`.
3. **Manual review gate** — `needsManualOcrReview(confidence, concerns, policy)`
   (shared/ocrPolicy.ts): any concern OR confidence below the admin policy floor
   forces review; policy is admin-editable at runtime.
4. **User approval** — `approveOcr` stamps `userVerifiedAt`; `setReviewState`
   marks reviewed/flagged (both write activity events).
5. **Access** — owner via ownership join; reviewer only via an active (non-revoked)
   assignment; every preview re-mints a fresh presigned URL (no long-lived links).

---

## 10. Security Model (as implemented)

- **AuthZ:** every private procedure re-derives ownership from `ctx.user.id`
  inside the DB query (`getOwnedApplicationDocument` / `getAccessibleApplicationDocument`
  patterns) — no client-supplied user ids are ever trusted.
- **CSRF:** OAuth state nonce bound to a `__Host-` cookie; session cookie options
  centralized in `_core/cookies.ts`.
- **Injection:** Drizzle parameterized queries throughout; filenames sanitized
  (`safeStorageFileName`); Zod on every input incl. length caps.
- **Privacy:** cohort visits store SHA-256 hashes, not tokens; OCR system prompt
  marks documents private; share/assignment flows require the counterpart account
  to exist (no enumeration of emails beyond "ask them to sign in").
- **Rate limits:** pilot feedback 5/10min/IP; help chat 12/10min/IP; both Maps
  prune closed windows past 500 entries (added in this audit — see §13).
- **Document URLs:** unguessable random-suffixed keys + short-lived presigned
  redirects + `no-store`.
- **Auditability:** three immutable event tables (user activity, review audit,
  OCR confidence) never expose note text in audit rows.
- **Secrets:** all via env (§11); never logged; OAuth server URL misconfiguration
  is loudly logged at boot.

---

## 11. Environment Variables (server/_core/env.ts)

| Variable | Used for | Required |
|---|---|---|
| `DATABASE_URL` | MySQL connection | yes |
| `JWT_SECRET` | session JWT signing | yes |
| `VITE_APP_ID` / OAuth client id | OAuth + JWT `appId` claim | yes |
| `OAUTH_SERVER_URL` | OAuth endpoints | yes |
| `OWNER_OPEN_ID` | project-owner identity fallback | recommended |
| `PLATFORM_API_URL` | storage/heartbeat/LLM/data API base | yes (platform) |
| `PLATFORM_API_KEY` | platform bearer key | yes (platform) |
| `PORT` | HTTP port (default 3000) | no |
| `NODE_ENV` | dev/prod branching (cron deferral, static serving) | no |

---

## 12. Testing & Verification (current state)

- `pnpm test` → Vitest, **38 files / 149 tests, all passing**; `pnpm check` →
  `tsc --noEmit`, clean; `pnpm build` → Vite production build, clean.
- Test coverage map: matching parity (client↔server), catalog filtering, OCR
  policy/status, document upload validation, expiry windows, reminder cron
  utility, scheduled handlers, reviewer collaboration invariants, verification
  history CSV/PDF content, pilot quota, cohort trend math, saved notes, admin
  views archive/backup, help-prompt validation, public UX wiring (static source
  assertions on Home.tsx/modals), PWA install contract.
- Client-side test files are included in the Vitest glob (`client/src/**/*.test.ts`).

---

## 13. Fixes Applied During This Audit (2026-09-04)

For a re-implementation, replicate these behaviours (they were live bugs here):
1. **State coverage:** the state list must include every state referenced by any
   catalog eligibility rule — incl. all 8 North-East states, Jammu & Kashmir,
   Ladakh (32 states/UTs total). Otherwise state-targeted scholarships are
   unmatchable.
2. **No placeholder state values:** scholarship checker previously offered
   "Other" which matches no rule → false "no match" results.
3. **Score-weight parity:** client fallback scorer must use 4/3/3
   (student/farmer/disability), not 5/5/5 — total must equal 100.
4. **Single catalog source:** derive the client fallback catalog from the same
   module the server seeds (never a second copy).
5. **Rate-limiter pruning:** prune closed windows once the map grows, or every
   unique IP leaks a permanent entry.
6. **Test discoverability:** the test runner must include client test globs, not
   just server ones.
7. **NSP deadline:** the announced NSP deadline (31 Oct 2026) lives in the shared
   catalog AND is re-pinned by the idempotent seed, so both sources agree.

---

## 14. Re-Implementation Checklist (porting to another stack)

1. **Schema:** recreate §4 tables with the same uniques/indexes (they encode the
   business rules). Migrations: `drizzle-kit generate && drizzle-kit migrate`.
2. **Catalog:** port `shared/schemeCatalog.ts` verbatim — it is pure data +
   types; the 31 NSP entries are generated from a compact directory list with
   shared defaults (category Education, age 10–45, student-required, generic
   documents/steps/portal).
3. **Matching:** port `server/schemeMatching.ts` (~54 lines, pure functions) and
   the client mirror; add the parity test first.
4. **API layer:** map each §5 procedure to your framework; keep Zod-equivalent
   refinements (start≤end, future+60s, reminder<due).
5. **Auth:** replace platform OAuth with your IdP but keep: nonce-bound state,
   upsert-on-login, 1-year signed session cookie, user/admin roles, optional-auth
   context.
6. **Storage:** any S3-compatible store; keep random-suffix keys + presigned
   GET redirects + 5MB/3-mime validation.
7. **OCR:** any vision+JSON-schema LLM; keep the strict schema, normalization
   caps, concerns/low-confidence convention, and the admin policy gate.
8. **Scheduling:** any cron that can POST to your app; keep the taskUid→DB-row
   dereference pattern and self-disabling one-shot jobs.
9. **AI help chat:** SSE streaming, 800-char input cap, cautious system prompt
   (no eligibility guarantees, no Aadhaar/OTP requests), IP rate limit.
10. **Seed:** idempotent catalog upsert on first read; never overwrite admin edits.
11. **Verify:** port the 149-test suite structure, especially
    `clientServerConsistency.test.ts`.

---

## 15. File Map (quick reference)

```
server/_core/          platform layer: sdk(OAuth+JWT), context, trpc (procedures),
                       heartbeat (cron SDK), llm (invoke/stream), storageProxy,
                       oauth routes, env, vite/static serving
server/routers.ts       entire tRPC surface (~1300 lines, all Zod inputs)
server/db.ts            all domain persistence (~4040 lines, 100+ exported fns)
server/schemeMatching.ts matching algorithm (pure)
server/schemeCatalogQuery.ts catalog filtering/sorting (pure)
server/documentOcr.ts    OCR LLM contract + normalization
server/documentUpload.ts upload validation + filename sanitization
server/scheduled.ts      3 cron handlers (taskUid-auth only)
server/schemeHelpRoutes.ts SSE help chat endpoint
server/pilotFeedback.ts  public quota limiter
server/applicationReminder.ts reminder cron builder
shared/                  schemeCatalog (data+types), applicationTracker,
                       ocrPolicy, const (cookie names, OAuth state codec)
drizzle/schema.ts       all 29 tables
client/src/lib/schemes.ts client mirror: fallback catalog derived from shared,
                       scoreScheme/getScoreBreakdown/getTier/deadline urgency
client/src/_core/hooks/useAuth.ts session/login client side
```

---

*Report generated from a full source audit including typecheck (clean), test run
(149/149 pass), and production build (success). All platform-dependent integrations
(platform storage/heartbeat/LLM/OAuth) are documented so they can be swapped for
self-hosted equivalents without changing domain behaviour.*
