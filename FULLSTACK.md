# Scheme Sathi Full-Stack Architecture

Scheme Sathi now runs as a **React + Express + tRPC + Drizzle** application. The public experience remains available without sign-in, while authenticated visitors gain persistent profiles and saved schemes.

| Layer | Responsibility | Implementation |
| --- | --- | --- |
| Public catalog | Bilingual scheme discovery, filters and detail information | `scheme_catalog` database table, seeded idempotently by the server from `shared/schemeCatalog.ts` |
| Matching | Deterministic, explainable eligibility ranking | `server/schemeMatching.ts` and `matching.run` tRPC mutation |
| Profile | One private profile per signed-in user | `user_scheme_profiles` table and `profile.mine` / `profile.save` procedures |
| Saved schemes | Saved scheme IDs per signed-in user | `saved_schemes` table and `saved.list` / `saved.toggle` procedures |
| Authentication | OAuth session, current-user context and role support | Manus OAuth template with `protectedProcedure` |
| Frontend | Loading, retry, anonymous fallback and account sync | `client/src/pages/Home.tsx` via typed `trpc.*` hooks |

## API Contract

Public callers can use `schemes.list`, `schemes.byId`, and `matching.run`. The matching mutation accepts a non-sensitive profile payload—age, location, social category, household income, occupation, gender and optional statuses—and returns ranked schemes with plain-language factor codes. Server-side hard gates prevent an explicitly state-, gender-, occupation- or status-restricted scheme from appearing for a mismatched profile.

Authenticated callers can use `profile.mine`, `profile.save`, `saved.list`, and `saved.toggle`. The application does not store Aadhaar, uploaded documents, bank account information or other identity documents.

## Catalog Seeding

The 11 reviewed scheme records are maintained in `shared/schemeCatalog.ts`. The `ensureSchemeCatalog()` helper uses an idempotent upsert when catalog APIs are called, so a deployment safely initializes and refreshes these records without duplicating them. Administrative editing can be added later through role-gated procedures that modify the same table.

## Operational Notes

The database migration is present in `drizzle/0000_purple_skrulls.sql` and has been applied. Run `pnpm test`, `pnpm check`, and `pnpm build` before releases. Anonymous visitors can still discover schemes and receive matches; their profile and saved schemes remain on the current device until they select **Sign in**, after which data persists against their authenticated account.

## Verification Record

The live browser flow was checked with an anonymous Maharashtra farmer profile. The three-step form completed successfully and the frontend called the server-side `matching.run` procedure, returning four ranked matches with an explained **Strong match** result. The public `schemes.list` API seeded and served 11 database-backed catalog records. Unit tests cover a strong farmer match and the exclusion of state-mismatched schemes; the full test suite, type check, and production build passed.

The same live flow opened the backend-backed Ayushman Bharat PM-JAY detail view, including match factors, document checklist, application steps and official portal action. Selecting **Save scheme** as an anonymous visitor changed the control to **Saved** and confirmed the local-device fallback through a toast; authenticated save/unsave operations are routed to the protected database procedures.

After a browser reload, the saved detail state still displayed **Saved**, confirming anonymous local persistence. Signed-in persistence is implemented through the protected database APIs and is ready to activate once a visitor selects the built-in sign-in control.

## Application Desk and Deadline Reminders

Authenticated visitors can add schemes to a private **Application Desk**, move them through considering, preparing, submitted, approved, not-approved, or closed states, save a reference number, and view a scheme deadline or add their own. Advanced Discovery supports state, category, deadline-window, and deadline-based sorting.

Each reminder is a user-owned Heartbeat job tied to an `application_reminders.scheduleCronTaskUid` value. The callback at `/api/scheduled/application-reminder` authenticates cron identity, looks up the reminder by that task UID, marks it delivered, and disables the annual cron after its first run. The delivered reminder status remains visible in the dashboard. Because platform-scheduled jobs target the production site, create a checkpoint and use the **Publish** control before a user schedules their first live reminder.

### Verification

Advanced Discovery was visually reviewed at `/discover`; it correctly shows state/category/deadline controls, deadline-first sorting, and the verified NSP deadline. A live tRPC smoke test for the `closingSoon` 90-day window returned only the NSP record. Application Desk was visually reviewed in both protected account-prompt and authenticated-preview states. Unit coverage validates UTC reminder cron generation, rejects non-cron callbacks, and verifies the task-UID-driven delivery lifecycle including one-time job disable. The full test suite, TypeScript check, and production build pass.

## Document Checklist and Scheme Administration

The Application Desk now derives every tracked scheme's required files from its catalog checklist. Each listed item accepts a replacement PDF, JPG, or PNG of up to 5 MB. File bytes are stored with the configured S3 helper; the database retains only checklist identity, original filename, MIME type, storage key, storage URL, and timestamps. The `documents.upload` and `documents.remove` procedures verify that the current user owns the tracked application before changing its files.

Administrators receive an additional **Manage schemes** navigation entry. The role-gated `admin.schemes` API permits updates to scheme titles, administering body, bilingual benefit summaries, official link, deadline date/label, and review note. It does not expose eligibility-rule or user-record updates. Application status changes use an optimistic client cache update with rollback on failure, saving feedback, a responsive hover lift, and independent upload states. Unit coverage validates upload type constraints, authenticated document ownership routing, and admin-only scheme editing. The document table and deadline columns were confirmed in the database; 12 tests, the TypeScript check, and production build pass.

### Development Verification Boundary

The dashboard and administrator UI were rendered against an authenticated project-preview account, and storage/schema/authorization behavior is covered by focused unit tests and database structure checks. No end-user file was uploaded and no production database edit was performed during development verification, so no personal documents or live catalogue data were introduced. The next signed-in user action will exercise the same protected upload and admin mutation paths that were validated by these contracts.

## Document Expiry and Hindi Checklist Support

Each uploaded checklist file can now carry an optional expiry date. The dashboard classifies it as valid, expiring soon during the final **14 days**, expired, or without an expiry date. A file in either follow-up state can be re-uploaded, its expiry date can be corrected, and the dashboard displays a private document-action notice. The daily `/api/scheduled/document-expiry-reminders` handler is idempotent: it authenticates the Heartbeat task, checks its durable task UID, creates at most one unread notification per document/state, and records its last completed scan.

The document checklist has an English/Hindi toggle. It keeps the stable English item ID for upload authorization and storage, while displaying the corresponding `documentsHindi` label, progress count, expiry state, and upload/re-upload guidance in Hindi when selected. Catalogue integrity testing confirms that each shipped English document item has a matching non-empty Hindi label.

The production-only daily Heartbeat job is exposed under the administrator's **Document Automation** section. It deliberately remains uncreated in this development-only project: the user must publish in the future and then select **Enable after publish** for the daily 03:00 UTC scan. Local verification covers the expiry classifier, idempotent callback path, non-cron rejection, bilingual label alignment, database schema, dashboard/admin rendering, TypeScript, and the complete **17-test** suite; no live cron job, user upload, or production data mutation was created.

## Secure Preview and AI OCR Review

Each uploaded document now has an owner-scoped **Preview** action. The protected API verifies the current user owns the tracked application and returns a short-lived signed storage URL only for that document. Images render in an in-dashboard preview modal; PDFs render through an embedded viewer. The stable storage key is never returned to the browser by the preview API.

Users may select **Extract details** to run a server-side multimodal OCR pass. The vision model receives only the short-lived signed URL and returns structured document type, detected name, reference values, dates, key details, concerns, and confidence. Results are marked `notRequested`, `processing`, `complete`, or `failed`; errors remain retryable, and every complete result explicitly asks the user to compare the extracted details with the preview before submission. OCR does **not** determine legal validity, identity authenticity, or scheme eligibility.

OCR output is private metadata attached to the document record. A document re-upload resets its OCR output; removing its application-document record removes its OCR metadata through the same record lifecycle. The deployed storage provider retains file bytes according to its own storage policy, so do not use this feature for documents the user is not authorized to upload. Development verification covered owner-scoped preview/extraction router contracts, extraction-field bounds, storage/schema integration, loading/failure/manual-review UI paths, and the complete **19-test** suite. No real user file was sent to the AI service during development.

### OCR Status Badges

Each uploaded document now exposes a non-color-only OCR status label alongside an icon. **Green — Details extracted** appears when a complete extraction has no model-reported concern and is not low confidence. **Amber — OCR pending** or **OCR in progress** marks an unrequested or currently running extraction. **Red — Manual review needed** appears for a failed extraction, a low-confidence result, or a result with OCR concerns. The badge text is bilingual with the checklist toggle and points the user to the applicable next action: start/retry extraction or manually compare the preview before submission.
