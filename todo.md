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
