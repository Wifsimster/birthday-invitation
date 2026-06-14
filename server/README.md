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
- HTTP Basic auth on admin endpoints, failing closed when unconfigured

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

### Admin endpoints (HTTP Basic auth)
```
POST   /api/rsvps            # manually add a submission (409 on duplicate phone)
GET    /api/rsvps             # all submissions
GET    /api/rsvps/count       # responses, confirmations, declines, total guests
GET    /api/rsvps/export.csv  # download all submissions as CSV
PUT    /api/rsvp/:id          # edit a submission
DELETE /api/rsvp/:id          # delete a submission
```

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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- UNIQUE index on phone enforces one RSVP per guest.
CREATE UNIQUE INDEX idx_rsvp_phone ON rsvp(phone);
```

The database file is created automatically on first start (see `DB_PATH` below).

## Security Features

- Rate limiting: global (300/15min), RSVP submit (5/hr), phone lookup (20/hr),
  admin auth (20/15min) — all proxy-aware via `trust proxy`
- Constant-time admin credential comparison (`crypto.timingSafeEqual`)
- Restrictive Content-Security-Policy (allow-lists only the font/icon CDNs)
- CORS disabled unless `CORS_ORIGIN` is set (same-origin SPA by default)
- Helmet.js for the remaining security headers
- zod input validation with length caps + email format; 64 kB JSON body limit
- CSV export escapes formula-injection (`= + - @`) so spreadsheets treat
  guest text as data, not formulas
- Public phone-lookup is rate-limited and returns only form fields (no IP)
- Logs redact the Authorization header/cookies and mask the lookup phone number
- HTTP Basic auth on admin endpoints (fails closed when credentials are unset)

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
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | —          | Basic-auth credentials for admin endpoints       |
| `EVENT_RSVP_DEADLINE`             | —            | `YYYY-MM-DD`; closes RSVPs (API + UI) once passed |
| `CORS_ORIGIN`                     | —            | Comma-separated cross-origin allow-list (off by default) |
| `TRUST_PROXY`                     | `1`          | Number of proxy hops to trust for `req.ip`       |
