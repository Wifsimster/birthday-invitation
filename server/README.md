# Birthday Invitation Backend

This is the Node.js backend server for the birthday invitation app with RSVP
functionality. It is written in **TypeScript** and run directly by Node 24's
native type stripping — there is no build step.

> **Note:** For complete project documentation, see the main [README.md](../README.md) file.

## Layout

| File           | Responsibility                                                |
| -------------- | ------------------------------------------------------------- |
| `server.ts`    | Bootstrap — opens the DB, builds the app, listens, shuts down |
| `src/app.ts`   | `createApp(db, options)` factory — routes, middleware, zod validation |
| `src/auth.ts`  | Better Auth (email/password) factory, migration + admin-seed helpers |
| `src/db.ts`    | Opens SQLite (better-sqlite3), runs schema/migrations, typed adapter |
| `src/event.ts` | Reads event env vars; builds the `.ics` calendar invite       |
| `src/logger.ts`| Shared pino structured logger                                 |
| `tests/`       | Vitest, hitting `createApp` over an in-memory database         |

The bootstrap and the test suite share the exact same `createApp`, so tests
cannot drift away from the routes that actually run in production.

## Features

- TypeScript throughout, type-checked with `tsc --noEmit` (no emit/bundle)
- SQLite storage via the synchronous `better-sqlite3` driver
- **zod** request validation (declarative schema, French error messages)
- **pino** structured logging (`pino-http` per-request logs)
- Rate limiting to prevent spam (proxy-aware via `trust proxy`)
- One RSVP per phone number, normalised to digits so the same number matches
  regardless of spacing/punctuation (re-submitting updates the existing row)
- CSV export of the guest list and an `.ics` calendar invite
- **Better Auth** email/password authentication on admin endpoints (cookie
  sessions); single admin seeded from the environment, public sign-up disabled

## API Endpoints

### Submit / update an RSVP
```
POST /api/rsvp
```
Body (`name`, `phone` and `attending` are required):
```json
{
  "attending": "yes",
  "name": "Child Name",
  "email": "parent@example.com",
  "phone": "06 12 34 56 78",
  "guests": 1,
  "message": "Optional note"
}
```
If an RSVP already exists for that phone number it is updated; otherwise a new
one is created (`201`).

### Look up an RSVP
```
GET /api/rsvp/lookup/:phone
```
Returns the RSVP for a phone number, or `404` if none exists. The phone is
normalised, so any formatting of the same number resolves to the same guest.

### Calendar invite
```
GET /api/event.ics
```
Returns an iCalendar invite built from the event environment variables, or `404`
when no event date is configured.

RSVP bodies may include `dietary_restrictions` (allergies). Submissions are
rejected with `403` once `EVENT_RSVP_DEADLINE` has passed. The lookup response
is rate-limited and returns only the fields the form needs (never `ip_address`).

### Settings (UI theme)
```
GET /api/settings            # { theme } — public, defaults to "fiesta"
PUT /api/settings            # set the active theme (admin)
```
The theme is stored on the **default event** row; the legacy routes above (and
all the `/api/rsvp*` routes) resolve to that default event for backward
compatibility with single-event deployments configured via env vars.

### Multi-event — public routes (per invitation `:slug`)
```
GET  /api/events/:slug                    # safe invitation fields + rsvp_closed
POST /api/events/:slug/rsvp               # submit/update an RSVP for this event
GET  /api/events/:slug/rsvp/lookup/:phone # look up this event's RSVP by phone
GET  /api/events/:slug/event.ics          # calendar invite for this event
```
`GET /api/events/:slug` returns only public fields (`slug`, `person`, `age`,
`date`, `time`, `town`, `location`, `dress_code`, `theme`, `rsvp_deadline`) plus
a computed `rsvp_closed` flag — never internal ids/timestamps. Unknown slugs
`404`. Submissions are scoped to the event: the **same phone can RSVP to several
events**. Once an event's `rsvp_deadline` has passed, submissions `403`.

### Multi-event — admin management
```
GET    /api/events            # list all events with aggregated RSVP counts
POST   /api/events            # create an event (auto-slug from person if omitted)
PUT    /api/events/:id        # update an event (partial)
DELETE /api/events/:id        # delete an event (its RSVPs cascade)
```
The list items include `responses`, `confirmations`, `declined` and
`total_guests`. Slugs are made unique automatically (`-2`, `-3`…); an explicit
duplicate slug `409`s. The default event's slug is fixed (`default`) and the
default event cannot be deleted (`400`).

### Multi-event — admin per-event RSVPs
```
GET    /api/events/:id/rsvps             # list this event's RSVPs (newest first)
GET    /api/events/:id/rsvps/count       # scoped counts
GET    /api/events/:id/rsvps/export.csv  # scoped CSV (filename rsvps-<slug>.csv)
POST   /api/events/:id/rsvps             # manually add (409 on duplicate phone)
PUT    /api/events/:id/rsvp/:rsvpId      # edit (scoped to the event)
DELETE /api/events/:id/rsvp/:rsvpId      # delete (scoped to the event)
```
An unknown event id `404`s. Edits/deletes only affect RSVPs that belong to the
named event.

### Authentication (Better Auth — email/password)
```
ALL  /api/auth/*              # Better Auth handler (sign-in, sign-out, session…)
POST /api/auth/sign-in/email  # { email, password } -> sets a session cookie
POST /api/auth/sign-out       # clears the session
GET  /api/auth/get-session    # current session (null when signed out)
```
Public self-service registration is disabled: `POST /api/auth/sign-up/*` is
blocked (`403`). The single admin account is seeded server-side from
`ADMIN_EMAIL` / `ADMIN_PASSWORD` on first start. The auth tables
(`user`, `session`, `account`, `verification`) are created by Better Auth's own
migrations at boot, alongside the app's SQLite database.

### Admin endpoints (require a valid admin session cookie)
```
POST   /api/rsvps            # manually add a submission (409 on duplicate phone)
GET    /api/rsvps             # all submissions
GET    /api/rsvps/count       # responses, confirmations, declines, total guests
GET    /api/rsvps/export.csv  # download all submissions as CSV
PUT    /api/rsvp/:id          # edit a submission
DELETE /api/rsvp/:id          # delete a submission
```
Unauthenticated requests to these routes get `401`.

### Health Check
```
GET /api/health
```
Returns server status.

## Development

```bash
cd server
npm install
npm run dev        # node --watch, type-stripped TS
npm start          # node server.ts
npm run typecheck  # tsc --noEmit
npm run lint       # eslint (typescript-eslint)
npm test           # vitest
```

Requires **Node 24+**, which strips TypeScript types at runtime by default (no
flag needed). The backend ships as TypeScript and is executed as-is — no
compile/emit step. CI runs typecheck + lint + tests, and builds the Docker image.

## Database

The server uses SQLite (via the synchronous `better-sqlite3` driver) with a simple schema:

```sql
CREATE TABLE event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  person TEXT NOT NULL DEFAULT '',
  age TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',          -- YYYY-MM-DD
  time TEXT NOT NULL DEFAULT '',
  town TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  dress_code TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'fiesta',
  rsvp_deadline TEXT NOT NULL DEFAULT '', -- YYYY-MM-DD or ''
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rsvp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  attending TEXT DEFAULT 'yes' CHECK(attending IN ('yes', 'no')),
  email TEXT,
  phone TEXT NOT NULL,
  guests INTEGER DEFAULT 1,
  dietary_restrictions TEXT,
  message TEXT,
  ip_address TEXT,
  event_id INTEGER REFERENCES event(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- One RSVP per phone *per event* (the unique constraint moved from phone to
-- (event_id, phone) in migration v3).
CREATE UNIQUE INDEX idx_rsvp_event_phone ON rsvp(event_id, phone);
```

Each invitation is an `event` row (theme, slug, details). A single
`is_default = 1` row backs the legacy single-event routes, so env-configured
deployments keep working: on boot `ensureDefaultEvent` seeds that row from the
event environment variables (and migrates any previously stored global theme),
but never clobbers it once an admin has edited it. The migration is idempotent
and runs automatically; the database file is created on first start (see
`DB_PATH` below).

## Security Features

- Rate limiting: global (300/15min), RSVP submit (5/hr), phone lookup (20/hr),
  admin login (20/15min), admin data routes (100/15min) — all proxy-aware
- Better Auth email/password sessions: passwords hashed (scrypt), httpOnly
  signed session cookies, built-in CSRF (Origin) checks on state-changing routes
- Public sign-up disabled — only the env-seeded admin account can sign in
- Restrictive Content-Security-Policy (allow-lists only the font/icon CDNs)
- CORS disabled unless `CORS_ORIGIN` is set (same-origin SPA by default)
- Helmet.js for the remaining security headers
- zod input validation with length caps + email format; 64 kB JSON body limit
- CSV export escapes formula-injection (`= + - @`) so spreadsheets treat
  guest text as data, not formulas
- Public phone-lookup is rate-limited and returns only form fields (no IP)
- Logs redact the Authorization header/cookies and mask the lookup phone number

## Serving the SPA

When `STATIC_DIR` is set (or `../dist` exists, as in the container), the same Node
process serves the built frontend: gzip compression, long-lived immutable caching
for hashed `assets/`, no-cache for `index.html` / `env.js`, and an SPA fallback to
`index.html` for client-side routes. No separate web server or process manager.

## Configuration

| Variable                          | Default      | Purpose                                          |
| --------------------------------- | ------------ | ------------------------------------------------ |
| `PORT`                            | `3000`       | Port the server listens on (SPA + API)           |
| `DB_PATH`                         | `../../data/rsvp.db` | SQLite database file location            |
| `STATIC_DIR`                      | `../dist`    | Built SPA to serve (omit to run API-only)        |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD`  | —            | Seeds the single admin account (password ≥ 8 chars) |
| `ADMIN_NAME`                      | `Admin`      | Display name for the seeded admin                |
| `BETTER_AUTH_SECRET`              | —            | Session signing secret (**required in production**) |
| `BETTER_AUTH_URL`                 | —            | External origin for cookie/origin scoping (set behind a proxy) |
| `EVENT_RSVP_DEADLINE`             | —            | `YYYY-MM-DD`; closes RSVPs (API + UI) once passed |
| `CORS_ORIGIN`                     | —            | Comma-separated cross-origin allow-list (off by default) |
| `TRUST_PROXY`                     | `1`          | Number of proxy hops to trust for `req.ip`       |
