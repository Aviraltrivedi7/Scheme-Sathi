# Scheme Sathi Full-Stack Upgrade

## Backend foundation

- [x] Upgrade static project to the full-stack web template.
- [x] Confirm generated backend, database, auth, storage, and environment conventions.
- [x] Define typed API contract shared by frontend and backend.

## Data model and APIs

- [x] Create the scheme catalog schema with bilingual content and normalized eligibility rules.
- [x] Seed the existing scheme catalog without fabricating user-generated content.
- [x] Implement scheme listing, search, category/level filtering, and detail endpoints.
- [x] Implement server-side eligibility matching and match-factor explanations.
- [x] Implement profile persistence and saved-scheme persistence for authenticated users.
- [x] Add safe anonymous fallback behavior where authentication is not required.

## Frontend integration

- [x] Replace local scheme reads with backend API calls.
- [x] Replace local-only profile and saved-scheme persistence with backend-backed flows.
- [x] Add loading, empty, error, retry, and stale-data states.
- [x] Keep the existing bilingual, responsive Scheme Sathi UI intact while wiring live data.

## Verification and handoff

- [x] Run type checks, production build, and API smoke tests.
- [x] Verify profile submission to ranked results end to end.
- [x] Verify scheme details, save/unsave, and refresh persistence.
- [x] Document environment variables, database setup, seed process, and remaining operational steps.

## Application dashboard and discovery upgrade

- [x] Inspect dashboard layout, reminder scheduling conventions, and current catalog contract.
- [x] Define application statuses, deadline fields, reminder rules, notification content, and user-level access rules.
- [x] Add application tracker and reminder database tables with safe foreign-key relationships.
- [x] Add deadline metadata and application state support to the scheme catalog.
- [x] Implement authenticated application tracking, status updates, and reminder APIs.
- [x] Implement deadline reminder scheduling and delivery behavior.
- [x] Build a user dashboard for tracked applications, due dates, reminders, and status updates.
- [x] Add advanced state, category, deadline-window, and deadline sorting controls to scheme discovery.
- [x] Test dashboard access, status persistence, reminder behavior, filters, and sorting.
- [x] Document the tracker workflow, reminder operations, and user-facing behavior.
- [x] Authenticated tracking/status/reference persistence is implemented, type-checked, and covered by owner-scoped API contract tests; end-user browser-session validation is intentionally deferred without user sign-in.
- [x] Live reminder create/cancel/callback verification is intentionally deferred by the user's no-publish constraint; callback lifecycle remains unit-tested locally.
- [x] Keep this upgrade development-only; no publishing or live reminder job creation was performed.

## Documents, administration, and interaction polish

- [x] Inspect storage, role-gating, dashboard, and status-update integration conventions.
- [x] Define document checklist, upload metadata, administrative editing, and micro-interaction behavior.
- [x] Add document upload metadata schema and protected storage-backed upload APIs.
- [x] Add admin-only APIs for updating scheme names, benefits, deadlines, and review metadata.
- [x] Build dashboard document-upload checklists with progress and file states.
- [x] Build an admin panel for editing scheme details and deadline dates.
- [x] Add loading animations, optimistic status updates, and hover feedback to application cards.
- [x] Test upload validation, authorization, schema, admin editor rendering, optimistic interaction behavior, and visual interactions; no personal file or live admin edit was created during development verification.
- [x] Document document handling, administrator controls, and deferred production behavior.

## Document expiry reminders and bilingual checklist

- [x] Inspect current document metadata, upload lifecycle, bilingual catalog fields, and scheduling conventions.
- [x] Define expiry/re-upload rules, reminder lifecycle, Hindi label mapping, and no-publish behavior.
- [x] Add document expiry metadata and reminder state to the database and upload contract.
- [x] Implement automated expiration/re-upload reminder scan and secure user-facing notification state.
- [x] Add Hindi document labels and bilingual progress/count messaging in the dashboard checklist.
- [x] Add expiry dates, re-upload controls, and reminder indicators to document checklist items.
- [x] Test expiry logic, reminder idempotency, bilingual labels, and dashboard states.
- [x] Document reminder scheduling behavior and development-only limitations.

## Document preview and OCR verification

- [x] Inspect secure storage preview, OCR/AI integration, and document privacy conventions.
- [x] Define preview authorization, OCR output, verification states, and retention behavior.
- [x] Add OCR extraction and verification metadata to the document schema.
- [x] Implement protected preview and AI OCR extraction APIs with owner checks.
- [x] Build dashboard document preview, extracted-detail review, and accuracy guidance UI.
- [x] Add clear loading, failure, retry, and manual-review states for OCR results.
- [x] Test preview authorization, OCR response validation, persistence, and dashboard interactions.
- [x] Document OCR privacy boundaries, verification behavior, and operational requirements.

## OCR verification status badges

- [x] Review OCR lifecycle states and current document checklist status rendering.
- [x] Define accessible color, label, and next-action rules for each OCR state.
- [x] Add color-coded OCR verification badges to uploaded document checklist items.
- [x] Verify badge rendering and state guidance through reusable state mapping tests covering success, pending, and manual-review outcomes; document checklist display consumes that mapping.

## Document timeline, OCR policy, and user approval

- [x] Inspect current document events, OCR lifecycle, and administrator configuration conventions.
- [x] Define timeline event taxonomy, user approval semantics, and configurable OCR manual-review policy.
- [x] Add document event and OCR policy persistence schema with user/admin ownership safeguards.
- [x] Implement activity recording, user OCR approval, and threshold-aware OCR status APIs.
- [x] Implement admin-only OCR confidence policy controls.
- [x] Apply the configured OCR confidence threshold server-side when returning document review state, with threshold-variation tests.
- [x] Build document activity timeline and user approval control in the dashboard.
- [x] Build OCR policy configuration in the admin interface.
- [x] Test timeline events, threshold behavior, approval persistence, and access controls.
- [x] Document timeline retention, OCR policy, and user verification behavior.
- [x] Add test coverage for timeline event construction/order and OCR approval persistence payloads.
- [x] Save and verify timeline, OCR policy, and user approval handoff documentation.

## Timeline export, filtering, and batch OCR review

- [x] Inspect timeline/document data, PDF export options, batch OCR controls, and current ownership boundaries.
- [x] Define verification-history PDF content, date/sort filters, batch review semantics, and safe limits.
- [x] Implement owner-scoped verification-history PDF export and download endpoint.
- [x] Implement timeline date-range and sorting filters in protected queries.
- [x] Implement batch OCR extraction and batch user approval APIs with per-document outcomes.
- [x] Build timeline filter/sort controls and PDF export action in the dashboard.
- [x] Build multi-document selection, batch review, and batch approval controls.
- [x] Test export access, PDF content, filter behavior, batch partial failures, and authorization.
- [x] Document export privacy, batch safety limits, and timeline query behavior.
- [x] Parse generated verification-history PDFs in tests and assert expected document/activity fields are present.
- [x] Add helper-level date-range and newest/oldest sort tests for timeline filtering behavior.

## Verification History search, hover preview, and OCR progress

- [x] Review current document preview authorization, history event payloads, and batch OCR component state.
- [x] Define safe hover-preview scope, keyword matching, and per-document batch progress behavior.
- [x] Extend private history data and preview access only as needed for owner-scoped document hover previews.
- [x] Add debounced quick search for verification-history document names, schemes, activity labels, and notes.
- [x] Build keyboard-accessible hover/focus document previews without exposing raw storage keys or persistent URLs.
- [x] Add batch OCR progress bar, running/completed/failed counts, and detailed per-document feedback.
- [x] Test preview authorization, search matching, progress calculations, error states, and responsive interactions.
- [x] Document hover-preview privacy boundaries, search scope, and batch-progress behavior.
- [x] Add a focused test for the hover-preview loading and unavailable-message states, then record mobile layout verification.

## Saved history filters, thumbnails, and OCR queue controls

- [x] Review current history filters, document preview contract, rendering options, and batch OCR queue state.
- [x] Define owner-scoped saved-filter persistence, thumbnail privacy/fallback behavior, and queue cancellation/retry semantics.
- [x] Add protected persistence and typed APIs for named verification-history filter presets.
- [x] Implement safe document thumbnail generation or fallback access without exposing storage keys or durable URLs.
- [x] Add saved-filter management and thumbnail-first history glance controls to the dashboard.
- [x] Add batch OCR queue cancellation, queued-document retry, and failed-document retry controls with clear status messaging.
- [x] Test saved-filter ownership, thumbnail fallback/access boundaries, queue cancellation, retries, and responsive states.
- [x] Document saved-filter privacy, thumbnail behavior, and OCR queue-control limitations.

## Default history view, expanded thumbnail, and OCR priority ordering

- [x] Review saved-filter database/API contract, current thumbnail hover card, and OCR queue processing order.
- [x] Define owner-scoped default filter behavior, signed enlarged-preview modal metadata, and queue reordering limits.
- [x] Add protected default-filter persistence and typed API support for saved history filters.
- [x] Add click-to-expand thumbnail modal with larger signed preview and safe document metadata.
- [x] Add accessible drag-and-drop OCR queue priority ordering before extraction begins.
- [x] Test default-filter restoration, ownership, enlarged-preview fallback, priority ordering, and responsive controls.
- [x] Document default view behavior, modal privacy boundary, and OCR queue priority limitations.

## PDF navigation, OCR queue ETA, and family filter sharing

- [x] Review PDF preview renderer, OCR queue state/timing, and authenticated user identity model.
- [x] Define safe paged-preview limits, ETA calculation disclosure, and family sharing recipient permissions.
- [x] Add protected owner-controlled sharing persistence and APIs for saved Verification History filters.
- [x] Add full PDF page navigation with page bounds, page count, and signed session-only rendering.
- [x] Add a transparent OCR queue time-remaining estimate based on observed batch extraction durations.
- [x] Add family filter share/revoke controls and accessible recipient feedback in the History workspace.
- [x] Test page navigation bounds, ETA calculations, sharing authorization, revocation, and responsive controls.
- [x] Document PDF preview privacy, ETA assumptions, and family filter-sharing limitations.

## Family invitation approvals, PDF transforms, and OCR confidence trends

- [x] Review current filter-share records, paged PDF preview renderer, and OCR extraction/confidence fields.
- [x] Define invitation pending/accepted/declined rules, preview zoom/rotation bounds, and confidence trend labels.
- [x] Add protected invitation lifecycle persistence and owner/recipient APIs for shared filters.
- [x] Add PDF zoom in/out, reset, and rotate controls to the expanded signed preview modal.
- [x] Add per-document OCR confidence trend indicators with clear current-state explanations.
- [x] Add invitation approval inbox and owner invitation-status controls in the History workspace.
- [x] Test invitation authorization/lifecycle, transform bounds, confidence-trend calculation, and responsive controls.
- [x] Document invitation privacy, preview transformation scope, and OCR confidence-trend limitations.
- [x] Re-render PDF pages at the active zoom level and test transform bounds/reset behavior.
- [x] Reset OCR confidence history on document re-upload and add focused isolation coverage.

## Invitation alerts, confidence chart, and PDF keyword search

- [x] Review pending invitation records, OCR confidence snapshots, and current browser-only PDF renderer.
- [x] Define read-state notification lifecycle, chart manual-review highlights, and session-only PDF text-search limits.
- [x] Add protected in-app invitation notification persistence and owner/recipient read-state APIs.
- [x] Add a visual OCR confidence trend chart that calls out documents requiring manual review.
- [x] Add keyword search with match counts and page navigation inside the signed PDF preview modal.
- [x] Add accessible invitation alert, confidence chart, and PDF search controls to the dashboard.
- [x] Test notification lifecycle, chart classifications, PDF search bounds/matches, and responsive states.
- [x] Document notification privacy, chart interpretation, and PDF search limitations.

## PDF highlights, manual-review priority, and reusable workflow skill

- [x] Review current PDF text-search renderer, confidence snapshots, and manual-review state source.
- [x] Define canvas-safe PDF highlight overlay behavior, priority score/ranking rules, and skill package boundaries.
- [x] Add page-level PDF text-match rectangles and visible highlight overlays without persisting document text.
- [x] Add a manual-review priority queue derived only from server-provided review state and confidence snapshots.
- [x] Add accessible queue navigation and search-result highlight controls to the dashboard preview workflow.
- [x] Create and validate a reusable skill documenting the secure collaboration-review implementation workflow.
- [x] Test PDF match geometry/highlighting, priority ranking, accessibility, and reusable skill validation.
- [x] Document highlight privacy, priority interpretation, and reusable skill scope.

## Complete backend and frontend integration audit

- [x] Re-read full-stack conventions and audit schema, database helpers, routers, frontend queries/mutations, and auth boundaries.
- [x] Inventory every user-facing feature against a backend procedure, ownership check, persistence path, and error/loading state.
- [x] Correct document upload/list response contracts so clients receive signed previews only, while preserving protected validation and ownership checks across existing APIs.
- [x] Harden remaining frontend mutations with typed cache invalidation and safe error messages for reminder cancellation, document removal, expiry updates, and notifications.
- [x] Add regression tests for corrected backend response-contract integration.
- [x] Run complete test, type check, production build, and visual integration review.
- [x] Document the completed backend contract map and operational integration behavior.

## Document quick actions, CSV export, and secure preview states

- [x] Review document action APIs, verification-history filters, OCR payloads, and preview modal rendering states.
- [x] Define owner-scoped review/inspection actions, CSV columns/escaping, and accessible preview skeleton/error behavior.
- [x] Add protected document inspection state and filtered history/OCR CSV export procedures.
- [x] Add document quick-action dropdowns with safe loading feedback.
- [x] Add accessible skeleton and illustrated recovery state to the secure document preview modal.
- [x] Test action authorization, CSV formatting/filter scope, and preview loading/error states.
- [x] Document quick-action semantics, CSV privacy, and preview state behavior.

## Family invite badge, reviewer audit trail, and PDF annotations

- [x] Audit existing invitation notifications, document ownership, timeline events, and signed PDF preview renderer.
- [x] Define assignment permissions, reviewer identity visibility, immutable audit event semantics, and private PDF-note retention rules.
- [x] Add protected persistence and typed APIs for reviewer assignments, review audit history, and page-scoped document notes.
- [x] Add a sidebar badge for unread pending family invitations and an accessible invitation destination.
- [x] Add reviewer assignment, status, and audit-trail controls to document review workflows.
- [x] Add private per-page annotation note controls to the secure PDF preview modal.
- [x] Test authorization, assignment/audit ordering, invitation badge count, annotation page scope, and responsive UI states.
- [x] Document reviewer accountability, invitation badge behavior, annotation privacy, and development-only verification.

## Reviewer alerts and audit-trail filters

- [x] Audit reviewer assignment lifecycle, current review audit payload, and existing in-app notification conventions.
- [x] Define recipient-only assignment notification read-state and date/status audit-filter semantics.
- [x] Add protected persistence and typed procedures for reviewer assignment alerts and filtered review audit history.
- [x] Add reviewer alert badge/inbox controls and audit date/status search controls in the review workspace.
- [x] Test notification recipient ownership, read transitions, audit date/status filters, and responsive feedback states.
- [x] Document reviewer alerts, audit-filter privacy, and development-only verification behavior.

## Reviewer alert preferences and assignment due-date reminders

- [x] Audit reviewer notification data, assignment lifecycle, existing heartbeat reminder callback, and current preference patterns.
- [x] Define recipient-owned reviewer alert preferences, assignment due-date visibility, and reminder timing/cancellation semantics.
- [x] Add protected persistence and typed APIs for reviewer preferences, assignment due dates, and automated reminder delivery.
- [x] Add reviewer preference controls and owner due-date/reminder controls to the collaboration workspace.
- [x] Test preference privacy, due-date validation, reminder delivery idempotency, cancellation, and responsive feedback.
- [x] Document reminder timing, non-publishing behavior, user controls, and development-only verification.

## Review workload, escalation, and reminder snooze

- [x] Audit reviewer assignments, due-date lifecycle, audit events, and reviewer alert delivery contracts.
- [x] Define workload metric semantics, owner-only overdue escalation, reviewer-only snooze timing, and audit visibility.
- [x] Add protected persistence and typed APIs for workload summaries, overdue escalation, and one-time reminder snoozing.
- [x] Add workload dashboard, overdue escalation controls, and reviewer reminder snooze actions to the collaboration workspace.
- [x] Test authorization, workload calculations, overdue status, escalation auditing, snooze timing, and responsive feedback.
- [x] Document review-management privacy, reminder limitations, non-publishing behavior, and development verification.

## Reviewer capacity limits and escalation templates

- [x] Restore development server health and inspect reviewer assignment and escalation workflow extension points.
- [x] Define reviewer-owned active-assignment capacity limits and owner-private escalation template semantics.
- [x] Add protected persistence and typed APIs for capacity preferences, capacity validation, and escalation template management.
- [x] Add reviewer capacity controls, owner template controls, and capacity-aware assignment/escalation UI feedback.
- [x] Test server recovery, capacity enforcement, owner/template privacy, assignment rejection, and responsive flows.
- [x] Document capacity behavior, template privacy, and development-only verification.

## Supplied implementation brief

- [x] Read the supplied brief and map its P0 real AI help-drawer requirement to existing Scheme Sathi capabilities.
- [x] Define the P0 AI help context, streaming transport, model privacy, and validation approach.
- [x] Implement the P0 Claude-powered streaming help drawer across backend and frontend.
- [x] Test the P0 help stream, bounded context, dynamic prompts, safety behavior, and public-page rendering.
- [x] Document and checkpoint the P0 development-only implementation.
- [x] Select the next supplied-brief priorities after P0 real AI help drawer.

## Approved P0/P1 public scheme UX sequence

- [x] Map score factors, responsive hero CSS, sharing, deadline metadata, and result-card comparison extension points.
- [x] Add bilingual score explanation modal with factor-level point reasoning.
- [x] Fix mobile hero stack order, height, and CTA spacing below 640px.
- [x] Add bilingual WhatsApp sharing beside the scheme link-copy control.
- [x] Add deadline urgency/closed-state banners with safe official-portal controls.
- [x] Add up-to-three scheme selection, floating comparison bar, and accessible full-screen comparison modal.
- [x] Test score reasoning, sharing URL, deadline boundaries, comparison cap, bilingual copy, and mobile layout.
- [x] Document and checkpoint the completed P0/P1 sequence without publishing.

## Reusable workflow skill, calendar sync, comparison export, and scheme notes

- [x] Review the established Scheme Sathi build workflow, saved-scheme data, comparison UI, and deadline metadata.
- [x] Define a reusable skill package plus calendar event, export, and owner-private note semantics.
- [x] Create and validate the reusable Scheme Sathi workflow skill package.
- [x] Add protected saved-scheme note persistence and typed APIs.
- [x] Add calendar deadline export, comparison PDF/CSV export, and personal note interfaces.
- [x] Test skill package, note ownership, iCalendar content, PDF/CSV content, and responsive flows.
- [x] Document and checkpoint the completed development-only implementation.

## Google Calendar sync, saved-note dashboard, and custom comparison exports

- [x] Review the current connector configuration plus deadline, saved-note, dashboard, and comparison export contracts.
- [x] Define credential-gated real Google OAuth activation boundaries alongside truthful local demo, note-filter, and export-field semantics.
- [x] Prepare the direct-sync interaction boundary without fabricating OAuth credentials or claiming a real Google connection.
- [x] Add owner-scoped saved-note listing and filtering APIs for the user dashboard.
- [x] Add Google Calendar demo controls, saved-note dashboard filters, and custom CSV/PDF comparison-field selection UI.
- [x] Test demo disclosure, note ownership/filtering, selected-field CSV/PDF output, and responsive states.
- [x] Document and checkpoint the completed development-only enhancement without publishing.
- [x] Implement the requested clearly labeled local Google Calendar demo mode until real OAuth credentials are supplied.

## Comparison export presets and saved-note management

- [x] Review the existing comparison export selector, saved-note APIs, dashboard panel, and scheme detail route state.
- [x] Define owner-private preset limits, field validation, deep-link context, and dashboard note edit/delete semantics.
- [x] Add protected comparison export preset persistence and saved-note management APIs.
- [x] Add preset save/load controls, dashboard scheme deep links, and inline note edit/delete actions.
- [x] Test preset ownership and validation, note update/delete ownership, deep-link state, and responsive interfaces.
- [x] Document and checkpoint the completed development-only enhancement without publishing.

## Mobile Need help drawer clipping fix

- [x] Inspect the mobile Need help drawer content height, scroll container, and footer visibility.
- [x] Fix the drawer sizing and internal scroll behavior so all help content remains reachable.
- [x] Test desktop/mobile drawer rendering and conversation overflow states.
- [x] Document and checkpoint the development-only bug fix without publishing.

## Scheme Sathi startup readiness analysis

- [x] Review the current Scheme Sathi product surface, differentiation, and startup readiness gaps.
- [x] Research official scheme-discovery infrastructure, user-access barriers, and relevant trust/compliance constraints.
- [x] Define target segments, startup positioning, monetization options, and a focused go-to-market wedge.
- [x] Produce a phased product roadmap, KPI scorecard, risk register, and practical next actions.

## Scholarship eligibility checker and pilot feedback landing

- [x] Review scholarship data, matching rules, routes, and existing public feedback/data patterns.
- [x] Define clear non-guarantee eligibility output, low-data interview form, consent, and retention semantics.
- [x] Add scholarship-only eligibility result and public pilot-feedback persistence APIs.
- [x] Build responsive scholarship checker and pilot landing page with structured feedback form.
- [x] Test matching boundaries, feedback validation/rate boundaries, bilingual copy, and mobile journey.
- [x] Document and checkpoint the development-only pilot upgrade without publishing.

## Verified scholarship catalog, feedback inbox, and cohort pilot invites

- [x] Review official scholarship source coverage, existing catalog model, feedback submission lifecycle, and admin UI patterns.
- [x] Define verified-record standard, admin feedback status/insight behavior, and revocable invite link semantics.
- [x] Add 30–50 source-verified scholarship records plus feedback inbox and cohort invite persistence/APIs.
- [x] Build responsive admin feedback analytics/inbox and custom cohort invite management with invite-aware pilot landing copy.
- [x] Test scholarship source coverage, admin-only inbox access, feedback management, invite lifecycle, and responsive flows.
- [x] Document and checkpoint the development-only pilot scale-up without publishing.

## Cohort conversion tracking and scholarship catalog navigation
- [x] Review invite lifecycle, authentication hooks, attribution/privacy boundaries, and expanded scholarship catalog interfaces.
- [x] Define cohort funnel events, anonymous-to-account conversion attribution, catalog filters, and sort behavior.
- [x] Add protected conversion tracking/analytics APIs and enriched scholarship catalog query support.
- [x] Build admin cohort conversion view plus responsive scholarship filters and sort controls.
- [x] Test cohort attribution/privacy, admin analytics, catalog filter/sort boundaries, and responsive journeys.
- [x] Document and checkpoint the development-only pilot analytics upgrade without publishing.

## Hindi scholarship navigation and cohort conversion reports

- [x] Review bilingual discovery UI, cohort analytics data, and report export boundaries.
- [x] Define Hindi provider/filter labels, date-range report metrics, export format, and privacy rules.
- [x] Add localized filter metadata and admin-only cohort date-range reporting APIs.
- [x] Build Hindi scholarship discovery controls and cohort report date-range/export interface.
- [x] Test localization, report aggregation, CSV export safety, and responsive journeys.
- [x] Document and checkpoint the development-only accessibility and reporting upgrade without publishing.

## Hindi state navigation, cohort trend chart, and CSV totals

- [x] Review state localization metadata, cohort event reporting, chart options, and CSV export structure.
- [x] Define Hindi state labels, monthly conversion series semantics, chart privacy, and CSV total rules.
- [x] Add localized state metadata, monthly aggregate reporting API, and CSV total calculations.
- [x] Build Hindi state dropdown and responsive monthly cohort conversion trend chart interface.
- [x] Test state localization, monthly aggregation, chart states, CSV totals, and responsive behavior.
- [x] Document and checkpoint the development-only localization and reporting refinement without publishing.

## Cohort-type trend filtering and monthly CSV detail

- [x] Review cohort trend data contracts, chart controls, Hindi date formatting, and CSV export layout.
- [x] Define cohort-type filter semantics, localized trend labels, monthly CSV section structure, and privacy boundaries.
- [x] Add cohort-type filtered monthly trend reporting and extended CSV monthly trend data.
- [x] Build cohort-type chart controls and Hindi localized trend visualization interface.
- [x] Test filtered trend aggregation, Hindi labels, monthly CSV section, and responsive behavior.
- [x] Document and checkpoint the development-only cohort trend refinement without publishing.

## Quarterly trend view and shared cohort funnel filtering

- [x] Review existing cohort segment filters, conversion funnel aggregation, and monthly trend contracts.
- [x] Define shared segment filtering, quarterly aggregation semantics, chart view behavior, and privacy rules.
- [x] Add segment-filtered funnel reporting and period-aware monthly or quarterly trend aggregation APIs.
- [x] Build shared cohort segment controls and monthly/quarterly trend visualization toggle.
- [x] Test filtered funnel data, quarterly rate aggregation, toggle behavior, and responsive journeys.
- [x] Document and checkpoint the development-only cohort analytics upgrade without publishing.

## Dashboard insight badges, segment totals, and shareable filters

- [x] Review trend data, funnel totals, dashboard filter state, and URL routing contracts.
- [x] Define change badge calculations, aggregate total semantics, shareable URL parameters, and privacy boundaries.
- [x] Add trend change calculations, funnel totals, and validated dashboard URL state synchronization.
- [x] Build change badges, funnel summary row, and shareable filter controls in the admin dashboard.
- [x] Test analytics calculations, URL state validation, sharing behavior, and responsive display.
- [x] Document and checkpoint the development-only dashboard insight upgrade without publishing.

## QoQ explanation, saved dashboard views, and read-only summary export

- [x] Review dashboard insight UI, filter URL state, persistence schema, and export options.
- [x] Define tooltip copy, private saved-view model, summary export format, limits, and privacy boundaries.
- [x] Add saved dashboard view persistence, protected APIs, tooltip metadata, and read-only summary export.
- [x] Build QoQ tooltip, saved-view controls, and selected-dashboard summary export interface.
- [x] Test tooltip accuracy, saved-view ownership and limits, summary export safety, and responsive journeys.
- [x] Document and checkpoint the development-only dashboard sharing upgrade without publishing.

## Pinned saved views, saved-view search, and bilingual dashboard summary

- [x] Review saved-view persistence, dashboard controls, and current summary export behavior.
- [x] Define pin ordering, private search behavior, bilingual export content, and data boundaries.
- [x] Add saved-view pin persistence, protected APIs, search support, and bilingual summary export.
- [x] Build pin controls, saved-view search interface, and export language toggle.
- [x] Test pin ownership and ordering, view search, bilingual export safety, and responsive behavior.
- [x] Document and checkpoint the development-only saved-view usability upgrade without publishing.

## Pinned view ordering, private folders, and Hindi PDF summary export

- [x] Review saved-view data model, pinned ordering, grouping options, and client-side PDF export capabilities.
- [x] Define pinned reorder semantics, private folder model, Hindi PDF layout, limits, and privacy boundaries.
- [x] Add saved-view ordering and folder persistence, protected APIs, and Hindi PDF export helper.
- [x] Build drag-and-drop pinned view controls, folder filtering interface, and Hindi PDF export action.
- [x] Test owner-scoped ordering and folders, Hindi PDF content, interactions, and responsive behavior.
- [x] Document and checkpoint the development-only saved-view organization upgrade without publishing.

## Saved-view shortcuts, folder management, and Hindi PDF print branding

- [x] Review the saved-view interaction contract, folder ownership model, and Hindi print helper customization points.
- [x] Add owner-private folder rename and bulk saved-view move APIs with validated input and safe cache behavior.
- [x] Build keyboard shortcuts for saved-view navigation and activation with accessible focus/input safeguards.
- [x] Build private folder rename and multi-view bulk-move controls in the admin dashboard.
- [x] Add custom Hindi PDF header and footer fields to the browser print layout without expanding report data scope.
- [x] Test shortcuts, folder ownership and mutations, print layout content, and responsive controls.
- [x] Document and checkpoint the development-only saved-view productivity upgrade without publishing.

## Folder counts, Hindi PDF presentation presets, and duplicate view shortcut

- [x] Review saved-view selection, folder filtering/count aggregation, duplicate-view naming, and print branding extension points.
- [x] Add protected owner-private duplicate saved-view API support with safe unique-name behavior.
- [x] Add folder count badges and a keyboard shortcut for duplicating the selected saved view.
- [x] Add browser-local Hindi PDF logo selection and predefined date-format presentation presets.
- [x] Test folder counts, duplicate ownership/name handling, PDF branding/date rendering, and shortcut wiring.
- [x] Document and checkpoint the development-only saved-view presentation upgrade without publishing.

## Saved-view archive, folder colors, and Hindi PDF preview

- [x] Review saved-view persistence, folder-label model, and browser-local Hindi print layout boundaries.
- [x] Add owner-private archive/restore state and folder color persistence with protected APIs and migration coverage.
- [x] Build active/archive saved-view controls, folder color selection, and color-aware private badges.
- [x] Build a live Hindi PDF preview modal using the current logo, header/footer, date-format, and aggregate filter scope.
- [x] Test archive/restore ownership, folder color handling, print preview markup, and responsive controls.
- [x] Document and checkpoint the development-only saved-view organization and preview upgrade without publishing.

## Bulk archived restore, folder color legend, and PDF layout controls

- [x] Review archived saved-view selection, folder color metadata, and shared Hindi print HTML builder extension points.
- [x] Add protected owner-private bulk restore support and printable margin settings validation.
- [x] Build archived-view selection and bulk restore, a visual folder color legend, and PDF preview zoom controls.
- [x] Add print margin presets to the live preview and final browser print flow.
- [x] Test bulk restore ownership, color legend mapping, zoom behavior, margin markup, and responsive controls.
- [x] Document and checkpoint the development-only saved-view recovery and PDF layout upgrade without publishing.

## Archive retention, PDF page markers, and folder quick actions

- [x] Review archive-state timestamps, private folder operations, and live preview layout extension points.
- [x] Add owner-private archive retention metadata and protected folder deletion support.
- [x] Build archived-view retention countdowns and folder quick actions for rename, delete, and color labels.
- [x] Add page-break guides to the adjustable live Hindi PDF preview without affecting final PDF content.
- [x] Test retention lifecycle, folder action ownership, page-marker rendering, and responsive controls.
- [x] Document and checkpoint the development-only saved-view lifecycle and PDF preview upgrade without publishing.
