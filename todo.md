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
