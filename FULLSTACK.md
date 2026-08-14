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

## Document Activity, OCR Policy, and User Approval

Each application document now maintains an immutable activity timeline. Server-side actions append concise events for upload/re-upload, expiry updates, OCR start/completion/failure, and the owner's final manual verification. The timeline is returned only inside the authenticated user's own tracked application data and is deleted with the document record.

An authenticated owner may select **I verified these details** only after OCR has completed. This records a `userVerifiedAt` timestamp and a timeline event, confirming the user reviewed the extracted summary against the private document preview. It does not make a legal, identity, or eligibility claim.

Administrators can set the singleton OCR minimum confidence policy to **low**, **medium**, or **high**. The backend applies this policy while serializing each document's authoritative `needsManualReview` state: any model concern is flagged regardless of confidence, and confidence below the configured threshold also requires manual review. The client consumes the policy for explanatory badges, while the server-provided state prevents downstream features from recalculating review rules independently. Development verification covers timeline event creation/order, approval persistence payload, admin-only policy controls, threshold variation, concern-driven review, and **31 automated tests** plus TypeScript and production build checks.

## Verification History Export and Batch OCR Review

Authenticated users can search their private document activity using an optional inclusive date range and newest/oldest ordering. The same selected filter is used by **Export PDF**, which returns a browser download containing up to 200 owner-scoped verification-history events: timestamp, scheme, document/checklist item, action, and available event note. It contains metadata only—never original file bytes, storage URLs, OCR prompt content, or other users' documents.

The **Batch Review** panel selects several uploaded documents at once. OCR batches are capped at **five** documents to limit workload; batch approval accepts up to ten completed OCR records. Each backend action is processed per document and returns individual success/failure outcomes, so an unreadable or unauthorized file does not invalidate other selected results. The dashboard refreshes results and leaves failed items available for individual retry or manual review.

Development verification parses generated PDFs and confirms scheme, document, and activity text are present; it also tests inclusive date-range filtering plus newest/oldest ordering, owner-scoped export routing, batch deduplication, batch partial-failure outcomes, and batch UI controls. The full suite contains **35 tests**, with TypeScript and the production build passing.

## Verification History Search, Hover Preview, and Batch Progress

The Verification History panel now accepts a short, debounced keyword query without changing the server's owner-scoped date-filter contract. It searches the already-returned private event metadata—document/checklist name, uploaded filename, scheme name, human-readable activity label, and event note—and preserves the selected date range and sort order. PDF export intentionally continues to reflect the date and sort selection rather than the transient dashboard text search.

Each history row carries only its document ID and MIME metadata in addition to its existing activity fields. The **Quick glance** control is a keyboard-accessible hover/focus card that calls the same owner-checked `documents.preview` procedure used by the full dashboard preview. A signed URL is requested only while the card is open; the browser never receives the storage key or a durable direct URL.

Batch OCR now runs each selected document sequentially in the dashboard, providing a live percentage indicator, current-file message, completed/failed counts, and retained per-document outcome messages. This makes progress visible during a long-running extraction while retaining independent failure handling and the five-document safety cap. Automated coverage verifies quick-search matching, history preview contract metadata and owner-bound preview routing, hover-preview loading/unavailable feedback, and queued/running/success/failure progress calculations. The complete suite now has **38 tests**, alongside clean TypeScript and production-build checks.

## Saved History Filters, First-Page Thumbnails, and OCR Queue Controls

Authenticated users can save a named **Verification History** filter preset containing their keyword search, date range, and sort preference. Presets are stored in the owner-scoped `saved_verification_history_filters` table, are unique by user and preset name, and can be applied or removed only through protected procedures. Applying a preset restores the history workspace; the PDF export remains intentionally scoped to the selected date range and sort rather than the transient keyword query.

Hover/focus **Quick glance** now renders the first PDF page into a small, in-memory browser thumbnail using PDF.js. The thumbnail starts only after the existing owner-checked preview procedure returns a short-lived signed URL; the storage key and durable URL remain server-side. Image documents display their own signed preview, while PDF rendering failures return a compact unavailable-state fallback rather than blocking the history list.

Batch OCR queue controls now allow the user to **stop queued items** while letting the active request finish safely. Remaining queued documents are labelled as cancelled and can be retried individually or in a selected batch; failed OCR documents also have targeted retry controls. The persisted OCR data model remains unchanged—queue cancellation is a dashboard control, not a claim that an already-started model request was interrupted. The saved-filter migration has been applied, desktop/mobile dashboard layouts were reviewed, and the full suite contains **40 tests** with TypeScript and production builds passing.

## Default History View, Expanded Preview, and OCR Priority

Each saved Verification History filter can now be marked as the owner’s **default view**. The protected default-setting procedure first confirms filter ownership, clears the user’s prior default, and applies the new selection; users may also clear it. On opening the dashboard, the client restores the single saved default once, without overwriting a user’s live edits. The `isDefault` field was added through a database migration and is returned with the typed saved-filter payload.

The private Quick glance card now opens a click-to-expand modal with a larger first-page rendering and limited metadata: checklist name, filename, scheme, activity type/date, MIME type, and the existing activity note. It reuses the owner-checked signed preview request, stores no storage key or durable URL in the client, and retains the loading/unavailable fallback. Escape and backdrop-close behavior are included.

Selected OCR documents can be reordered with native drag-and-drop before extraction begins; equivalent move-up/down controls keep the priority queue keyboard-accessible. The queue order is passed directly to sequential extraction, so priority affects the next batch only. Reordering is locked once processing starts, preserving unambiguous progress and cancellation behavior. Router tests cover owner-scoped set/clear default actions, while queue tests cover deterministic reordering. **42 tests**, TypeScript validation, production build, and desktop/mobile layout verification pass.

## Full PDF Navigation, OCR ETA, and Family Filter Sharing

The enlarged document glance now renders a signed PDF one page at a time and exposes bounded **Previous** and **Next** controls with the current page and total page count. Page rasterization stays browser-local and session-bound to the existing owner-checked preview URL; no storage key, durable link, or original document bytes are persisted by the client. Non-PDF images retain their signed preview behavior.

During an OCR batch, the progress panel samples the durations of completed documents and updates an estimated remaining time every second. Before the first document completes, the interface explicitly says it is still estimating. This is a local, best-effort estimate for the current sequential batch only; it is not a service-level guarantee and intentionally excludes any unstarted retry batch.

Saved-filter owners can share only the filter criteria with an already-signed-in family account identified by its email address. Recipients can apply shared criteria to their own History workspace but never see the owner’s history events, application records, documents, or default-filter controls. Owners can revoke access at any time. The schema migration for owner/recipient share records is applied. Automated coverage validates PDF bounds, ETA math, owner-scoped share/revoke actions, and recipient visibility; **45 tests** pass along with TypeScript, production-build, desktop, and mobile checks.

## Invitation Approval, Preview Transform Controls, and Confidence Trends

Family sharing now follows an explicit approval lifecycle. An owner sends a **pending invitation** to an already-signed-in family account, which can accept or decline it from a private inbox. Only accepted invitations appear as reusable filters for the recipient. Owners retain the ability to revoke either a pending invite or accepted access; the recipient never gains access to source documents, verification events, applications, default-view state, or the ability to edit the owner’s saved filter.

The signed PDF preview modal now includes bounded page navigation, **zoom out/zoom in**, rotation in 90-degree steps, and reset. PDF.js re-renders the selected page at the active zoom scale before the browser applies the visible transform, preserving readability better than a fixed low-resolution thumbnail. The controls remain session-only and use the existing owner-checked signed preview URL; image previews preserve their standard signed behavior.

Each successful OCR extraction writes an immutable confidence snapshot with its concern count. The document timeline turns the current snapshot sequence into an understandable baseline, improving, steady, or lower trend message. Re-uploading a document clears the prior file’s confidence snapshots before the new OCR lifecycle starts, preventing old-file confidence from appearing in a replacement document’s trend. The invitation-status and OCR-confidence migrations are applied. **49 tests** pass, with TypeScript, production build, desktop, and mobile reviews complete.

## Invitation Alerts, Confidence Charting, and PDF Keyword Search

Family filter invitations now create a recipient-scoped, email-style **in-app alert**. Each unread alert exposes accept, decline, and dismiss actions; accepting or declining also marks the related alert read. Reissuing an invitation reopens it as pending and resets the corresponding alert to unread. Notification access and read-state updates are protected by the intended recipient’s user ID.

Documents with OCR confidence snapshots show a compact line chart in their activity timeline. The chart plots low, medium, and high confidence over successive extractions, draws the current medium threshold, and gives a distinct manual-review callout when server-derived `needsManualReview` is true. It is interpretive only: users must still compare OCR metadata with their original document, and re-upload starts a clean trend.

The expanded signed PDF preview now supports keyword searching across the first **40 pages** in the browser. It returns match counts per page and lets users jump directly to a matched page. Text extraction occurs only while the signed preview is open; neither extracted text nor the storage key is persisted. The alert lifecycle, chart classification, and PDF match/bounds helpers are unit-tested, while desktop and mobile dashboard layouts have been reviewed.

## PDF Match Highlights, Manual-Review Priority, and Reusable Workflow

PDF keyword search now adds transparent saffron overlays directly over matching PDF text items on the rendered page. Search scans at most 40 pages in browser memory, stores only temporary match geometry in component state, and lets the user jump to a matched page. Highlight geometry is calculated from PDF.js text-item coordinates at the active page scale; it is not persisted or sent back to the server.

The **Manual Review Queue** includes only documents already marked by the server as needing manual review. It ranks those entries by current confidence, model concern count, and a lower confidence trend, then explains the signals behind each position. The queue is a navigation aid—never an eligibility, identity, or approval decision—and its Review action scrolls to the matching document checklist entry.

The reusable **secure-collaboration-review** skill packages the safe workflow: owner-scoped signed previews, bounded browser-local PDF search/highlighting, immutable OCR confidence snapshots, conservative manual-review ordering, and invitation-based filter sharing. It was validated with the skill validator. Highlight geometry, queue ranking, and all application behavior are covered by the expanded automated suite.

## Backend and Frontend Integration Audit

The user-facing application flows were audited against their typed tRPC procedures, database helpers, authentication boundary, and frontend mutation/query consumer. Public discovery and matching remain read-only; all profile, saved scheme, application, reminder, document, OCR, history, family-sharing, notification, and administrative actions use protected or administrator-only procedures as appropriate. Ownership checks are enforced at the database-helper layer for tracked applications, uploaded documents, OCR, reminders, history filters, invitation actions, and notification read-state updates.

| Area | Backend contract | Frontend integration and safety behavior |
|---|---|---|
| Application Desk | Owner-scoped `applications.*` procedures and persistence helpers | Typed queries/mutations invalidate the application cache after status, tracking, and reminder changes. |
| Document workflow | Validated upload, owner-checked preview/OCR/approval/removal procedures | Upload, preview, OCR, expiry, re-upload, and approval controls expose pending/error feedback. |
| File access | Persisted storage key remains server-side; list and preview flows issue signed GET URLs | The upload mutation returns metadata only; the application list supplies short-lived signed download URLs and previews are separately owner-checked. |
| History and collaboration | Owner-scoped filters, defaults, invitations, read-state alerts, and accepted shared criteria | History controls refresh typed caches after every mutation, and recipients can only apply shared criteria. |
| Administration | Administrator-only scheme, automation, and OCR-policy procedures | Admin screen uses role-gated queries and mutation invalidation. |

The audit added a regression contract asserting that raw persisted storage routes are omitted from the upload response. Dashboard mutations for reminder cancellation, document removal, expiry updates, and document notifications now provide safe error feedback while retaining typed cache invalidation. The authenticated dashboard was visually rechecked on desktop and mobile after the contract change; the responsive history and family-filter controls continue to render without runtime errors. The full suite has **54 tests** across 20 test files, TypeScript validation succeeds, and the production build succeeds. The build emits a standard chunk-size advisory for the rich PDF/document tooling, but it does not block the build or application behavior.

## Document Quick Actions, CSV Export, and Preview Recovery

Each uploaded document now has a compact **quick-action menu** in the Application Desk. The authenticated owner can mark a document as `reviewed`, flag it for `inspection`, or clear the state. The selected state is stored in the application-document record, reflected in the private document timeline, and updated through the owner-scoped `documents.setReviewState` procedure. It is an internal workflow marker only; it does not assert that a document is legally valid, authentic, complete, or accepted by a government office.

The Verification History panel now provides **Export CSV** beside Export PDF. The CSV uses the exact active date range, chronological order, and debounced text query. It includes only owner-scoped activity metadata and the associated OCR status, confidence, document type, detected name, model concerns, and review state. It never includes document bytes, storage keys, signed URLs, raw prompt material, another user’s activity, or family members’ records. Values are RFC-style quoted and double-quote escaped; formula-leading cells are prefixed with an apostrophe to reduce spreadsheet formula interpretation. Export is bounded to the newest 1,000 matching events.

The full dashboard preview modal now shows an animated content skeleton while the short-lived signed URL is requested. If that request fails or the URL expires, it displays a clear recovery panel that explains the private-preview issue, exposes a retry action, and confirms that no document content was shown. The secure server procedure continues to check document ownership before issuing a preview URL.

Focused router coverage confirms that review-state and CSV calls are made with the signed-in owner ID and active filters. CSV regression coverage confirms commas, embedded quotes, and spreadsheet-formula prefixes are safely represented. Existing preview-feedback coverage verifies loading and unavailable guidance. The complete suite now has **56 tests** across 21 test files; `pnpm check` and the production build complete successfully. The project remains development-only: no publishing, live reminder job, or real end-user document action was performed for this update.

## Family Invitation Badge, Reviewer Accountability, and Private PDF Notes

The private dashboard sidebar now queries the recipient-scoped unread invitation endpoint and displays a numeric **Family invitations** badge when pending shared-filter invites exist. Selecting it returns the user to the Application Desk and scrolls to the existing accept/decline invitation panel. The count is derived only from unread notifications whose filter-share status is still pending; it does not expose the sender’s document, activity, applications, or history results.

Document owners may now assign a reviewer by the reviewer’s email address after that account has signed in at least once. The owner can list or revoke their document’s assignments, while reviewers can see only their own active assignments, start a review, mark it complete, and open a signed preview for that assigned document. A revocation immediately removes reviewer preview and annotation access. Assignment, start, completion, revocation, and note create/update/delete actions write immutable review-audit entries that include actor, timestamp, action, and a concise non-sensitive description. The audit deliberately does not preserve PDF-note text.

The review workspace adds a secure PDF preview with browser-local page navigation and a **Private notes** panel. Page notes are scoped to the signed-in author, document, and page number. They are not shared with the owner, reviewer, family filter recipients, or other users; the author may edit or delete their own notes. The existing protected preview procedure now permits an active assigned reviewer to receive a fresh signed URL for only that document, while all owner-only document modifications remain owner-scoped.

Migration `0012_luxuriant_pride.sql` creates review assignments, review audit events, and PDF annotations with cascade and access-control foreign keys. The generated migration originally exceeded MySQL’s foreign-key name length on one constraint; it was repaired with short constraint names before applying the same non-destructive schema to the development database. Database verification confirmed 2 annotation foreign keys, 3 assignment foreign keys, and 3 audit foreign keys. Automated coverage now has **60 tests** across 23 files; TypeScript and production build validation pass. Desktop and mobile dashboard screens were reviewed with no publish or live reminder job created.

## Reviewer Assignment Alerts and Audit Filters

Assigning or reassigning a reviewer now creates or refreshes one recipient-scoped **in-app review alert**. The reviewer sees the unread alert in the Review Collaboration workspace and through a sidebar **Review alerts** badge. Opening the alert marks it read and opens only that reviewer’s secure assigned-document preview; dismissing it marks it read without opening the file. Alerts are filtered server-side to the signed-in recipient and omit revoked assignments. They include only the document name, file metadata, scheme name, assignment state, and owner display name—never document bytes, storage keys, signed URLs, OCR output, PDF-note text, or another reviewer’s data.

The review audit trail now accepts optional inclusive date boundaries and one or more event-status filters: assigned, started, completed, revoked, note added, note edited, and note deleted. The workspace applies date boundaries as local-day start/end values, supports multi-select status chips, and provides an explicit clear-filters control. Authorization remains unchanged: document owners and currently active assigned reviewers may view an accessible document’s audit; revoked reviewers cannot access it. The filter applies to audit metadata only and never reveals the private content of PDF annotations.

Migration `0013_medical_slyde.sql` adds the notification table, recipient/status index, and short MySQL-compatible foreign-key names. Focused router tests cover recipient-scoped notification list/read transitions and date/status forwarding; UI contract tests cover the alert tray, sidebar label, event-status chips, and clear control. The full suite now contains **61 tests** across 23 files, with TypeScript and production build validation passing. Mobile dashboard review was completed; no publishing, live reminder job, or real user notification was created.

## Reviewer Alert Preferences and Review Due-Date Reminders

Reviewers now have account-private **Reviewer Settings** in the collaboration workspace. They can independently enable or disable new-assignment alerts, choose whether automated review due-date alerts may appear, and set a default lead time from one hour to seven days. These settings are evaluated when an owner assigns the reviewer and again at reminder-delivery time, so turning off a preference prevents the related in-app alert without exposing the choice to the document owner or other reviewers.

Owners can now select one active reviewer on an uploaded document, set a review due date, and optionally choose one reminder time before it. The owner can cancel a scheduled reminder or revoke the reviewer; either action clears the stored schedule reference and attempts to disable the corresponding one-time task. The protected due-date callback resolves the assignment only from its authenticated task UID, creates one recipient-scoped unread due-date alert if the reviewer permits it, records a non-sensitive `dueReminderSent` audit event, marks delivery, and disables its one-time job. Repeated callbacks are idempotent because only a `scheduled` reminder can deliver.

Migration `0014_good_omega_flight.sql` adds reviewer preferences, due-date/reminder lifecycle fields, due-reminder notification kind, and the audit event enum value. It preserves the notification table’s foreign-key support while replacing the old one-alert-per-assignment unique key with a per-assignment-and-kind key. Development database verification confirmed the preference foreign key and all five assignment reminder columns. The complete suite now has **63 tests** across 23 files; TypeScript and the production build pass.

The project remains development-only at the user’s request. Due-date dates and reminder intent can be saved locally in development, but a live Heartbeat task is intentionally **not** created until the project is published. After publication, saving the same reminder timing creates the one-time automated callback; no live reviewer reminder, scheduled job, or real user notification was created during this implementation.

## Review Workload, Overdue Escalation, and Reminder Snooze

The collaboration workspace now contains a recipient-scoped **My Review Workload** dashboard. It counts active, assigned, in-review, due-within-48-hours, overdue, and escalated assignments from the signed-in reviewer’s active assignment set. It also lists each active document with its local due date and escalation state. The workload API does not return another reviewer’s assignments or an owner’s unrelated reviews.

Document owners receive an **Owner Escalations** panel for their own active overdue reviews. Escalation is rejected before the due time and for completed or revoked assignments. An owner may add a concise accountability note while escalating or resolving an escalation; the state and note are durable, while the immutable review audit receives only the action and safe description. Reviewers can see their escalated state in their workload and filter the corresponding audit events, but cannot create or resolve owner escalations.

Unread due-date alerts now offer a reviewer-only **snooze** action. A snooze must be at least one minute in the future and before the assignment’s due date. It records the reviewer action, clears the former schedule reference, increments the snooze count, and refreshes the same recipient-only due-date alert when the subsequent one-time callback runs. Snooze respects the reviewer’s due-reminder preference. As with all reviewer timing automation, development saves intent but does not create a live scheduled task; live delivery remains deferred until publication.

Migration `0015_plain_baron_zemo.sql` adds snooze and escalation lifecycle fields and explicitly expands the audit enum for snooze/escalation events. Development database verification confirmed all five assignment fields and all audit enum states. Focused router and UI contract coverage now has **64 tests** across 23 files; TypeScript and production builds pass. No live reminder, scheduled job, escalation, or user notification was created.

## Reviewer Capacity Limits and Owner Escalation Templates

The development server was restarted after it stopped responding, and the public landing route again rendered successfully. The reviewer preference panel now includes a **Maximum active reviews** limit from 1 through 50, with a default of 5. When an owner assigns or reactivates a reviewer, the server counts that reviewer’s active assigned and in-review documents. If the configured limit has already been reached, the protected assignment procedure rejects the request before creating an assignment or alert. Lowering a capacity below the user’s current workload is permitted but prevents additional active assignments until the count falls below the new limit.

Owners can now maintain up to 20 **private escalation templates**, each with a short name and a 500-character follow-up message. Templates are scoped by owner user ID and are never returned to another user. In the overdue-review panel, an owner may apply a template to populate the accountability note before escalating or resolving an overdue review. The client safely substitutes only the visible review context tokens `{reviewer}`, `{document}`, and `{dueDate}`; the saved template itself does not gain access to document bytes, OCR data, annotation text, signed URLs, or anyone else’s information.

Migration `0016_reflective_shocker.sql` adds the reviewer capacity column and the owner-private escalation-template table with a verified owner foreign key. The complete suite now contains **65 tests** across 23 files; TypeScript and production builds pass. The server is running again. No publish action, live reminder task, real review assignment, or real escalation was created during this update.

## P0 Real AI Help Drawer

The public **Need help?** drawer now uses a real server-side, streamed Claude response rather than the former keyword-matching reply. The drawer sends the current question, selected interface screen, session-only profile values, and selected scheme summary (when one is open) to `POST /api/help/stream`. The server builds a constrained prompt using `claude-haiku-4-5`, streams OpenAI-compatible SSE deltas back to the browser, and applies a per-IP limit of 12 help requests per ten minutes. The model key remains server-side; no key, saved conversation, profile record, document, storage key, or signed URL is sent to the browser.

The prompt changes its quick questions on the home, profile, results, and details screens. It requests clear Hindi or English based on the active language, includes a visible typing state while chunks arrive, and gives safe recovery guidance if the service is unavailable. System instructions prohibit definite eligibility claims, invented official rules, and requests for Aadhaar, bank details, passwords, OTPs, or document uploads. It tells the user to verify requirements and deadlines on the official portal.

`server/schemeHelp.test.ts` covers bounded bilingual request validation and selected-scheme context construction, while the UI contract test confirms streaming endpoint, dynamic prompts, and typing state presence. The real SSE endpoint was smoke-tested with a development-safe public query; it returned Claude output successfully. The full suite now contains **67 tests** across 24 files, and TypeScript, production build, and public landing-page rendering pass. The old static function remains inert; the live help trigger renders the new streamed drawer. No publishing or real personal user data was used.

## P0/P1 Public Scheme Discovery Improvements

The public results experience now explains matching transparently. Each score pill opens a bilingual **score explanation modal** containing every weighted rule used by the local matching model: age (15), income (15), category (18), work profile (22), state (12), gender (8), and status-specific rules (5 each). A matched rule displays its earned points and a clear reason; a non-matching rule displays zero with the reason. The score remains a discovery aid only and explicitly does not confirm final eligibility.

On screens narrower than 640px, the public hero now stacks in the specified order: visual first, then headline and supporting copy, then full-width CTAs. The existing page retains its desktop editorial composition while the mobile arrangement eliminates excess hero height and gives action buttons a direct, thumb-friendly flow.

Scheme details now include a bilingual **WhatsApp share** action. It opens WhatsApp with a concise prefilled message containing the scheme name, short benefit summary, available deadline state, and official portal URL; ordinary copy-link behavior remains available beside it. No recipient, personal profile, or document data is stored by the application as part of sharing.

Deadline metadata now drives a visible urgency banner. A deadline within 30 days appears as closing soon with a date; a timestamp already in the past is correctly classified as closed even if it is less than one day old. Closed schemes disable the direct application button while retaining source-aware guidance to check the official portal.

Users can select up to three result cards for comparison. The fixed comparison bar prevents the fourth selection, requires at least two choices to open, and launches an accessible full-screen comparison modal for benefit summary, match score, key eligibility, documents, steps, and official links. All selection state remains browser-local for the session.

Focused public UX coverage verifies weighted score reasoning, deadline boundaries, WhatsApp URL construction, comparison cap wiring, and mobile hero order. The complete suite now has **70 tests** across 25 files; TypeScript, production build, fresh server restart, and desktop/mobile landing renders pass. No publishing or live user sharing action was performed.
