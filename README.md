# 🎉 Birthday Invitation

A small self-hosted birthday invitation web app with online RSVP. A single-page
frontend shows the event details (who, when, where, dress code) and lets guests
confirm their attendance; a Node.js/Express backend stores RSVPs in SQLite.

**Multi-event:** the admin panel (`/admin`) manages any number of events at
once. Each event has its own theme, invitation link (`/e/<slug>`), QR code and
RSVP list. The `BIRTHDAY_*` / `EVENT_*` environment variables seed a **default
event** (served at `/`) so existing single-event deployments keep working
unchanged; further events are created and edited entirely from the admin UI.

Deployed on the homelab as `wifsimster/birthday-invitation` behind Traefik at
`leo-birthday.${DOMAIN}`.

> ℹ️ **Provenance:** this repository was originally reconstructed from the
> published Docker image (the original Vite source had been lost). The frontend
> has since been **rebuilt from source** under [`frontend/`](frontend/) — a
> Vue 3 + Vite SPA — so `dist/` is now a build artifact (git-ignored) produced
> by `npm run build`, not committed assets.

## Architecture

```
                 ┌──────────── container (port 3000) ────────────┐
  browser ─────► │  Node (Express 5) — single process            │
                 │   ├── /api/*  → RSVP API + SQLite             │
                 │   └── /*      → static SPA from /app/dist     │
                 └───────────────────────────────────────────────┘
```

- **Frontend** — Vue 3 + Vite SPA under [`frontend/`](frontend/): a per-event
  invitation view (`/` for the default event, `/e/:slug` for any other) with the
  RSVP and lookup forms, and a multi-event admin dashboard (`/admin`) that lists
  every event and lets the host create, edit, theme, share (link + QR) and manage
  RSVPs for each one. Built to `dist/` by `npm run build`. The invitation view
  fetches its event from the API by slug; the `BIRTHDAY_*` / `EVENT_*` values
  injected into `dist/env.js` by [`infra/inject-env.sh`](infra/inject-env.sh)
  seed the default event and provide an initial paint for `/`.
- **Backend** — **TypeScript** (run via Node's native type stripping, no build
  step). Express 5 serves both the SPA and the API in a **single process**
  (compression, static caching and SPA fallback built in — no reverse proxy or
  process manager). SQLite storage (better-sqlite3), rate limiting, Helmet,
  **zod** validation and **pino** structured logging.
  Phone number is the guest identity (normalised to digits, so the same number
  matches regardless of spacing/punctuation; one RSVP per phone, re-submitting
  updates it). The host can export the guest list as CSV and guests can download a
  calendar invite. Structured as a thin bootstrap (`server.js`) over a testable
  `createApp(db)` factory and `db` / `event` modules — see
  [`server/README.md`](server/README.md).
- **Runtime** — [`infra/docker-entrypoint.sh`](infra/docker-entrypoint.sh) injects
  the event env into the SPA, then runs the Node server (which receives signals
  for graceful shutdown).

## Configuration

All event details come from environment variables. Copy [`.env.example`](.env.example)
to `.env` and fill them in.

| Variable          | Purpose                                    |
| ----------------- | ------------------------------------------ |
| `BIRTHDAY_PERSON` | Name shown on the invitation               |
| `BIRTHDAY_AGE`    | Age                                        |
| `EVENT_DATE`      | Date (`YYYY-MM-DD`)                         |
| `EVENT_TIME`      | Time range                                 |
| `EVENT_TOWN`      | Town                                       |
| `EVENT_LOCATION`  | Full address / location label              |
| `DRESS_CODE`      | Dress code note                            |
| `EVENT_RSVP_DEADLINE` | Optional `YYYY-MM-DD`; closes RSVPs (UI + API) once passed |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seeds the admin login (password ≥ 8 chars) |
| `BETTER_AUTH_SECRET` | Session signing secret (**required in production**; `openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | External origin for session cookies (set behind a proxy) |
| `CORS_ORIGIN`     | Optional cross-origin allow-list (off by default) |
| `DOMAIN`          | Base domain for the Traefik router         |
| `BACKUP_KEEP` / `BACKUP_INTERVAL` | Snapshots to keep / seconds between DB backups |

## Run with Docker

```bash
cp .env.example .env   # edit values
docker compose up -d
```

`compose.yml` pulls the published image and wires up the Traefik router. To build
locally instead, point the service at the included [`Dockerfile`](Dockerfile). The
app container runs as a non-root user.

### Backups

The SQLite database is the only copy of every RSVP. `compose.yml` includes a
`backup` sidecar that takes a consistent `sqlite3 .backup` snapshot to a separate
`birthday_backups` volume on an interval (`BACKUP_INTERVAL`, default daily),
keeping the latest `BACKUP_KEEP` (default 14). To restore, stop the app and copy
a `rsvp-*.db` snapshot over `/app/data/rsvp.db`.

## API

Each event is addressed by its `slug`; the public routes below resolve the event
from the URL. The legacy un-slugged routes (kept for backward compatibility)
operate on the **default event**.

**Per-event (public)**

| Method   | Endpoint                                | Auth  | Description                              |
| -------- | --------------------------------------- | ----- | ---------------------------------------- |
| `GET`    | `/api/events/:slug`                     | —     | Public event details + `rsvp_closed`     |
| `POST`   | `/api/events/:slug/rsvp`                | —     | Submit/update an RSVP for the event       |
| `GET`    | `/api/events/:slug/rsvp/lookup/:phone`  | —     | Look up an RSVP within the event          |
| `GET`    | `/api/events/:slug/event.ics`           | —     | Calendar invite (.ics) for the event      |

**Event management (admin)**

| Method   | Endpoint                                | Auth  | Description                              |
| -------- | --------------------------------------- | ----- | ---------------------------------------- |
| `GET`    | `/api/events`                           | admin | All events with per-event counts          |
| `POST`   | `/api/events`                           | admin | Create an event (auto-slug from name)     |
| `PUT`    | `/api/events/:id`                       | admin | Edit an event (details + theme)           |
| `DELETE` | `/api/events/:id`                       | admin | Delete an event (default event protected) |
| `GET`    | `/api/events/:id/rsvps`                 | admin | RSVPs for the event                       |
| `GET`    | `/api/events/:id/rsvps/count`           | admin | Counts for the event                      |
| `GET`    | `/api/events/:id/rsvps/export.csv`      | admin | Export the event's RSVPs as CSV           |
| `POST`   | `/api/events/:id/rsvps`                 | admin | Manually add an RSVP (409 on duplicate)   |
| `PUT`    | `/api/events/:id/rsvp/:rsvpId`          | admin | Edit an RSVP within the event             |
| `DELETE` | `/api/events/:id/rsvp/:rsvpId`          | admin | Delete an RSVP within the event           |

**Default event / legacy**

| Method   | Endpoint                  | Auth  | Description                              |
| -------- | ------------------------- | ----- | ---------------------------------------- |
| `GET`    | `/api/health`             | —     | Health check                             |
| `POST`   | `/api/rsvp`               | —     | Submit/update an RSVP (default event)    |
| `GET`    | `/api/rsvp/lookup/:phone` | —     | Look up an RSVP (default event)          |
| `GET`    | `/api/event.ics`          | —     | Calendar invite (.ics), default event    |
| `GET`    | `/api/settings`           | —     | Current UI settings (default theme)      |
| `ALL`    | `/api/auth/*`             | —     | Better Auth (sign-in, sign-out, session) |
| `PUT`    | `/api/settings`           | admin | Set the default event's theme            |
| `POST`   | `/api/rsvps`              | admin | Manually add an RSVP (409 on duplicate)  |
| `GET`    | `/api/rsvps`              | admin | All RSVPs (default event)                |
| `GET`    | `/api/rsvps/count`        | admin | Counts (default event)                   |
| `GET`    | `/api/rsvps/export.csv`   | admin | Export RSVPs as CSV (default event)      |
| `PUT`    | `/api/rsvp/:id`           | admin | Edit an RSVP                             |
| `DELETE` | `/api/rsvp/:id`           | admin | Delete an RSVP                           |

Admin endpoints are protected by [Better Auth](https://better-auth.com)
email/password sessions (cookie-based). The single admin account is seeded from
`ADMIN_EMAIL` / `ADMIN_PASSWORD` on first start, `BETTER_AUTH_SECRET` signs the
session cookies, and public self-service sign-up is disabled. Unauthenticated
requests get `401`. See [`server/README.md`](server/README.md) for request/response
details and the database schema.

## Backend development

```bash
cd server
npm install
npm run dev        # node --watch (type-stripped TS)
npm run typecheck  # tsc --noEmit
npm test           # vitest (runs against the real app via createApp)
npm run lint       # eslint (typescript-eslint)
```

The TypeScript server is split for testability:

| File             | Responsibility                                   |
| ---------------- | ------------------------------------------------ |
| `server.ts`      | Bootstrap: open DB, build app, listen, shutdown  |
| `src/app.ts`     | `createApp(db, options)` — routes, zod validation |
| `src/auth.ts`    | Better Auth (email/password) + admin-seed helpers |
| `src/db.ts`      | Open SQLite (better-sqlite3), schema/migrations  |
| `src/event.ts`   | Event config + `.ics` calendar invite            |
| `src/themes.ts`  | Allow-list of valid theme ids (settings validation) |
| `src/logger.ts`  | pino structured logger                           |
| `tests/`         | Vitest hitting `createApp` over an in-memory DB  |

Tests exercise the same `createApp` used in production, so they can't drift from
the real routes. CI runs typecheck + lint + tests and builds the Docker image on
every push and PR (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Frontend development

```bash
cd frontend
npm install
npm run dev      # Vite dev server (proxy /api to the backend, or run both)
npm run build    # builds the SPA into ../dist (served by the backend)
```

| File                     | Responsibility                                   |
| ------------------------ | ------------------------------------------------ |
| `src/App.vue`            | Root + global styles, `<router-view>`            |
| `src/views/Invitation.vue` | Per-event invitation, RSVP + lookup (`/`, `/e/:slug`) |
| `src/views/Admin.vue`    | Multi-event admin: events list, create/edit/theme/share, per-event RSVPs (`/admin`) |
| `src/router.js`          | Routes (`/`, `/e/:slug`, `/admin`)               |
| `src/env.js`             | Reads runtime config from `window.ENV`           |
| `src/themes.js`          | Theme catalog + `applyTheme` (CSS custom properties) |

### Themes

The invitation has a selectable visual theme (Fiesta, Spider-Man, Iron Man,
Pat' Patrouille, Mickey, Princesse, Dino, Espace, Licorne). The admin picks one
from the **🎨 Thème** panel in `/admin`; it is persisted server-side in the
`settings` table and applied to every visitor. Each theme is pure CSS
(palette + emoji + fonts, no image assets) defined in `frontend/src/themes.js`,
applied by writing `--theme-*` CSS custom properties on `<html>`. The
server-side allow-list in `server/src/themes.ts` must stay in sync with the
ids in that catalog.

The Docker image builds the SPA from this source (multi-stage build), so `dist/`
is never committed. For a full local run, build the frontend once, then start the
backend (`DB_PATH=… node server/server.js`), which serves `../dist`.
