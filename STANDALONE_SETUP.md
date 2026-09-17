# Scheme Sathi — Standalone Backend Setup

The backend now runs **fully self-hosted** with only Node.js + MySQL — no
platform required. Everything documented in `BACKEND_IMPLEMENTATION_REPORT.md`
(tRPC API, 29-table schema, OCR pipeline, reviewer workflow, reminders,
pilot analytics) works identically; the platform integrations are replaced:

| Platform service | Standalone replacement |
|---|---|
| Platform OAuth login | Email + password accounts (`/api/auth/register`, `/api/auth/login`) with scrypt hashes + the same HS256 session cookie |
| Platform S3 storage | Local disk under `LOCAL_STORAGE_DIR` (default `./local-storage`), served through the same `/app-storage/*` proxy |
| Heartbeat HTTP-cron | In-process scheduler: one-shot timers + a 60s DB reconciliation scan that survives restarts |
| Platform LLM (OCR/chat) | Any OpenAI-compatible endpoint (`LLM_BASE_URL`), or honest offline fallbacks |

## Quick start (dev)

```bash
# 1. MySQL — either a local server or the bundled compose file:
docker compose up mysql -d

# 2. Configure:
cp .env.example .env         # edit DATABASE_URL if needed

# 3. Create the schema (idempotent):
pnpm db:push

# 4. Run:
pnpm dev
```

### Zero-install MySQL on Windows (no Docker, no admin rights)

Portable MariaDB runs from your user folder — nothing to install:

```powershell
# 1. Download + extract (one time, ~90 MB):
New-Item -ItemType Directory "$env:LOCALAPPDATA\SchemeSathi\downloads" -Force
curl.exe -L -o "$env:LOCALAPPDATA\SchemeSathi\downloads\mariadb.zip" https://archive.mariadb.org/mariadb-11.4.9/winx64-packages/mariadb-11.4.9-winx64.zip
Expand-Archive "$env:LOCALAPPDATA\SchemeSathi\downloads\mariadb.zip" "$env:LOCALAPPDATA\SchemeSathi" -Force
Rename-Item "$env:LOCALAPPDATA\SchemeSathi\mariadb-11.4.9-winx64" "$env:LOCALAPPDATA\SchemeSathi\mariadb"

# 2. Create data dir + root password once, then initialize:
New-Item -ItemType Directory "$env:LOCALAPPDATA\SchemeSathi\data" -Force
$pw = -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
$pw | Set-Content "$env:LOCALAPPDATA\SchemeSathi\db-password.txt" -NoNewline
& "$env:LOCALAPPDATA\SchemeSathi\mariadb\bin\mariadb-install-db.exe" "--datadir=$env:LOCALAPPDATA\SchemeSathi\data" "--password=$pw"

# 3. Start it (new terminal, or double-click Start-SchemeSathi.ps1):
& "$env:LOCALAPPDATA\SchemeSathi\mariadb\bin\mariadbd.exe" "--datadir=$env:LOCALAPPDATA\SchemeSathi\data" --port=3307 --bind-address=127.0.0.1 --console

# 4. Point the app at it and migrate:
"DATABASE_URL=mysql://root:$pw@127.0.0.1:3307/scheme_sathi" | Set-Content .env -NoNewline
$env:DATABASE_URL = "mysql://root:$pw@127.0.0.1:3307/scheme_sathi"
pnpm db:push
```

Data persists in `%LOCALAPPDATA%\SchemeSathi\data` across restarts — back it up
if the schemes, accounts, or review history matter to you.

The app boots at `http://localhost:3000`. Sign in via **Sign in → Create an
account** — the first registered account becomes admin automatically
(or set `STANDALONE_ADMIN_EMAIL` to promote a specific address).

> Client note: the client asks the server `GET /api/auth/mode` at runtime
> (cached per page load), so one build works on both platform and standalone
> deployments — every "Sign in" button routes to `/login` automatically on a
> standalone backend. `VITE_AUTH_MODE=credentials` remains as a fallback hint
> for static previews without a backend.

## What changes in standalone mode

### Authentication
- `POST /api/auth/register` — `{ name, email, password }` (password ≥8 chars).
  Creates the user + scrypt credential row, sets the session cookie.
- `POST /api/auth/login` — `{ email, password }` → session cookie.
- Accounts get openIds namespaced `local:<email>` so they can never collide
  with platform OAuth subjects if you later migrate to the platform.
- `trpc.auth.mode` returns `{ mode: "credentials" | "oauth" }` at runtime.
- Logout (`trpc.auth.logout`) and role checks work unchanged. The runtime
probe `GET /api/auth/mode` (also mirrored as `trpc.auth.mode`) tells the
client which flow to use, so no client rebuild is needed when switching
deployment modes.

### Storage
- Uploads land in `LOCAL_STORAGE_DIR` (gitignored) with the same
  unguessable random-suffix keys and the same ownership checks; previews
  stream through `/app-storage/<key>` with `Cache-Control: no-store`.
- Path traversal is rejected (`localKeyPath` resolves + contains-checks).

### Scheduling
- `reminders.create`, reviewer due-date reminders, snoozes, and the daily
  document-expiry scan register in-process jobs that POST to the exact same
  `/api/scheduled/*` handlers (authenticated by a `cron_<taskUid>` session JWT —
  the same contract the platform uses).
- The 60-second reconciliation scan delivers anything in the DB whose time
  has passed, so a restart never loses a pending reminder.
- `admin.documentAutomation.enable` re-registers the daily 03:00 UTC scan,
  and it is re-armed automatically on boot from `document_reminder_settings`.

### OCR / help chat
- With `LLM_BASE_URL` + `LLM_API_KEY` set (any OpenAI-compatible server),
  OCR and the help chat work exactly as on the platform.
- Without them: OCR completes with a low-confidence, concern-flagged
  "manual review" extraction (never fake data), and the help chat streams
  honest static guidance pointing to official portals.

## Production

Option A — Docker (recommended):

```bash
# Set JWT_SECRET in docker-compose.yml first!
docker compose up --build -d
```

Option B — bare Node (the runtime probe means no build-time flag needed):

```bash
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
export JWT_SECRET DATABASE_URL=... NODE_ENV=production
pnpm install --frozen-lockfile
pnpm exec vite build
pnpm db:push
pnpm start
```

Multi-instance deployments: each instance runs its own scheduler scan;
handlers are idempotent (status-guarded lookups), so double-fires are safe.
Set a shared `JWT_SECRET` across instances.

## Security notes
- Always set `JWT_SECRET` in production (standalone dev fallback is
  deterministic by design for single-node dev only). The server prints a
  loud warning at boot when it is missing.
- `local-storage/` must be backed up and must not be served by any static
  file server other than the ownership-checked proxy in this app.
- Rate limits, Zod validation, ownership checks, and audit events are
  unchanged from the platform mode (see report §10).

## Hardening (built in)

These controls ship enabled — no configuration needed:

- **Cookies work over plain HTTP on a LAN.** Standalone sessions use
  `SameSite=Lax` (browsers silently reject `SameSite=None` without `Secure`,
  which would break every non-TLS deployment). Platform mode keeps
  `None` + `Secure`.
- **Brute-force throttling.** Registration: 20/hour per IP and per email.
  Login: 10 per 15 minutes per IP and per email. Excess requests get a
  uniform 429 (the message never reveals which limit fired).
- **Weak-password blocklist.** ~22 notorious passwords (`password123`,
  `qwerty123`, …) are rejected at registration even though they meet the
  8-character minimum.
- **Security headers.** Every response carries
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
  `Referrer-Policy: same-origin`, and a restrictive
  `Content-Security-Policy` (`default-src 'self'`, `object-src 'none'`,
  `frame-ancestors 'self'`; dev adds `unsafe-eval` for Vite HMR).
- **API responses are `Cache-Control: no-store`.** Session-bearing
  responses (like `auth.me`) must never land in browser or intermediary
  caches — important on shared machines (cyber cafés, college labs).
- **`GET /api/health`.** Runs `SELECT 1` against the database and returns
  `{status, mode, auth, database, uptimeSeconds, checkedAt}` — 200 when
  healthy, 503 when the DB is down. `docker-compose.yml` wires it into the
  container `HEALTHCHECK`, so orchestrators restart a broken instance
  instead of routing users to it.
- **HTTPS gets `Secure` cookies automatically.** The session cookie's
  `Secure` attribute follows the request protocol (direct TLS or a proxy
  that forwards `X-Forwarded-Proto`), while plain-HTTP LAN logins keep
  working.
- **Graceful shutdown.** SIGTERM/SIGINT stop accepting connections, finish
  in-flight requests, then exit (10s force-exit backstop). Stray
  `unhandledRejection`/`uncaughtException` are logged without crashing the
  process.
- **Open-redirect-safe login return.** The login page honors
  `?next=<path>` — a user bounced from a deep link lands back where they
  were. Only same-app paths pass (`/` prefix, no `//`, no backslashes);
  absolute or protocol-relative URLs are ignored.
- **Catalog seeded once per process.** The 44-row scheme seed runs on the
  first catalog read and is memoized — no re-upsert on every request.

## Delivery performance (built in)

No reverse proxy required — the app already ships fast on plain Node:

- **Compression.** Every response over 1KB is gzip/deflate-compressed
  (browsers negotiating brotli get brotli). The 556KB app entry chunk
  travels as ~159KB on the wire (72% smaller).
- **Immutable asset caching.** Everything under `/assets/` (content-hashed
  filenames) is served with `Cache-Control: public, max-age=31536000,
  immutable` — returning visitors load JS/CSS from disk cache instantly.
  Entrypoints (`/`, `index.html`, `sw.js`, `manifest.webmanifest`,
  `offline.html`) are `no-cache` so a new deploy is picked up on the next
  visit.
- **Route-level code splitting.** Only the home page ships in the entry
  bundle; every other route (Discover, Dashboard, Pilot admin, …) is a
  lazy chunk fetched on first navigation, and heavy vendors (pdf.js,
  Recharts) only download on the pages that use them. First paint went
  from one 1.4MB bundle to ~556KB (159KB compressed) + a tiny per-route
  chunk.
- **Self-hosted fonts.** The type families (DM Serif Display, Plus Jakarta
  Sans, Noto Sans Devanagari) ship as local woff2 from `/assets/` —
  CSP-clean (no third-party style origins), offline-capable through the
  service worker, and no render-blocking Google Fonts round-trip.
- **Lean HTML shell.** `index.html` is ~1KB (616B compressed). No third-party
  preview overlay ships in CLI builds.
- **Structured API errors.** Unknown `/api/*` routes return a JSON 404
  (never the SPA shell with a 200), and thrown errors return a clean 500 —
  JSON for API clients, a plain HTML page for humans — instead of Express's
  default stack-trace page. Set `HSTS=1` to also send
  `Strict-Transport-Security` when serving behind TLS.

### Behind a reverse proxy (nginx / Caddy / load balancer)

Set `TRUST_PROXY=1` **only** when the app runs behind a proxy you control.
It makes Express derive the client IP and protocol from
`X-Forwarded-For` / `X-Forwarded-Proto`, which two things need:

- Per-IP rate limits use the real client IP — without it every visitor
  shares the proxy's IP and 30 students logging in at once trip the
  global login limit (accidental lockout).
- Session cookies get the `Secure` attribute when the proxy speaks HTTPS.

Without `TRUST_PROXY`, those headers are ignored (spoofable by clients),
so do NOT enable it for a directly-exposed deployment.

```yaml
# docker-compose.yml app service:
environment:
  TRUST_PROXY: "1"
```

The proxy must set both headers itself (nginx:
`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` /
`proxy_set_header X-Forwarded-Proto $scheme;`).

Verify it all end to end (in-memory MySQL, 15 checks):
`pnpm e2e:standalone` — probes health + headers, weak-password rejection,
and login throttling (429) against the real bundled server.

## Catalog sync bot (every 5 minutes, no API key)

A built-in bot watches official sources and publishes new schemes straight to
the catalog — no approval clicks needed:

- **Default watcher:** PIB press releases (`pib-announcements` source, enabled,
  auto-publish on). Every 5 minutes it scans the latest releases, keeps only
  scheme-like announcements (yojana/scholarship/abhiyan + launch verbs, with a
  blocklist for visits, speeches, space/defence missions, and weather items),
  and publishes matches as `officialNotice` entries.
- **Quality guard:** PIB serves bots a JS-challenge page instead of release
  text. The bot detects boilerplate (`isQualityReleaseSummary`) and publishes
  an honest pointer draft ("open the source link to read the full release")
  rather than page junk — never invented details.
- **Runbook:** each tick records per-source fetched/new/updated counts in
  `scheme_sync_runs`, visible in Admin → Catalog Automation along with bot
  liveness, next sweep, and recent runs. Floods are capped (5 new per source
  per sweep; duplicates are idempotent via content hashes).
- **Needs MySQL:** without a database the bot logs a `no-database` skip and
  retries next tick. Public discovery keeps working from the shared catalog
  either way.
- **Tuning:** keywords, blocklist, and category inference live in
  `server/schemeSync.ts` (`isSchemeAnnouncement`, `inferCategoryFromTitle`).
  Keyed sources (data.gov.in CKAN, myScheme JSON, RSS) can be added from the
  admin panel alongside the keyless PIB watcher.

