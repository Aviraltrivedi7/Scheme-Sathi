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
