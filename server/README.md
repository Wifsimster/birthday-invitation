# Birthday Invitation Backend

This is the Node.js backend server for the birthday invitation app with RSVP functionality.

> **Note:** For complete project documentation, see the main [README.md](../README.md) file.

## Layout

| File         | Responsibility                                              |
| ------------ | ----------------------------------------------------------- |
| `server.js`  | Bootstrap — opens the DB, builds the app, listens, shuts down |
| `src/app.js` | `createApp(db, options)` factory — all routes and middleware  |
| `src/db.js`  | Opens SQLite, runs schema/migrations, promise-wraps the handle |
| `src/event.js` | Reads event env vars; builds the `.ics` calendar invite      |
| `tests/`     | Vitest, hitting `createApp` over an in-memory database          |

The bootstrap and the test suite share the exact same `createApp`, so tests
cannot drift away from the routes that actually run in production.

## Features

- SQLite database for storing RSVP data
- Rate limiting to prevent spam (proxy-aware via `trust proxy`)
- CORS enabled for frontend communication
- Input validation and sanitization
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

### Admin endpoints (HTTP Basic auth)
```
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

## Installation

1. Install dependencies:
```bash
cd server
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Database

The server uses SQLite with a simple schema:

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

- Rate limiting: 100 requests per 15 minutes per IP
- RSVP rate limiting: 5 RSVP submissions per hour per IP
- `trust proxy` so per-IP limits use the real client address behind Traefik
- Helmet.js for security headers
- Input validation and sanitization
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
| `TRUST_PROXY`                     | `1`          | Number of proxy hops to trust for `req.ip`       |
