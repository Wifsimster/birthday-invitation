# 🎉 Birthday Invitation

A small self-hosted birthday invitation web app with online RSVP. A single-page
frontend shows the event details (who, when, where, dress code) and lets guests
confirm their attendance; a Node.js/Express backend stores RSVPs in SQLite.

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

- **Frontend** — Vue 3 + Vite SPA under [`frontend/`](frontend/): an invitation
  view (`/`) with the RSVP and lookup forms, and an admin view (`/admin`). Built
  to `dist/` by `npm run build`. Event details are injected at container start into
  `dist/env.js` by [`infra/inject-env.sh`](infra/inject-env.sh) and read via
  `window.ENV`, so the same image works for any event.
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

| Method   | Endpoint                  | Auth  | Description                              |
| -------- | ------------------------- | ----- | ---------------------------------------- |
| `GET`    | `/api/health`             | —     | Health check                             |
| `POST`   | `/api/rsvp`               | —     | Submit/update an RSVP (keyed by phone)   |
| `GET`    | `/api/rsvp/lookup/:phone` | —     | Look up an existing RSVP by phone        |
| `GET`    | `/api/event.ics`          | —     | Calendar invite (.ics) for the event     |
| `GET`    | `/api/settings`           | —     | Current UI settings (selected theme)     |
| `PUT`    | `/api/settings`           | admin | Set the active UI theme                  |
| `POST`   | `/api/rsvps`              | admin | Manually add an RSVP (409 on duplicate)  |
| `GET`    | `/api/rsvps`              | admin | All RSVPs                                |
| `GET`    | `/api/rsvps/count`        | admin | Confirmation, decline and guest counts   |
| `GET`    | `/api/rsvps/export.csv`   | admin | Export all RSVPs as CSV                  |
| `PUT`    | `/api/rsvp/:id`           | admin | Edit an RSVP                             |
| `DELETE` | `/api/rsvp/:id`           | admin | Delete an RSVP                           |

Admin endpoints use HTTP Basic auth (`ADMIN_USERNAME` / `ADMIN_PASSWORD`) and
fail closed (`503`) when those are unset. See [`server/README.md`](server/README.md)
for request/response details and the database schema.

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
| `src/views/Invitation.vue` | Invitation, RSVP form and lookup (`/`)         |
| `src/views/Admin.vue`    | Admin panel: login, stats, list, edit/delete (`/admin`) |
| `src/router.js`          | Routes                                            |
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
