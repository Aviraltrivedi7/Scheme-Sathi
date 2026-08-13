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
