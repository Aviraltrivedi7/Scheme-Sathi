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
