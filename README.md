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
> React 19 + Vite SPA — so `dist/` is now a build artifact (git-ignored) produced
> by `npm run build`, not committed assets.

## Architecture

```
                 ┌──────────── container (port 3000) ────────────┐
  browser ─────► │  Node (Express 5) — single process            │
                 │   ├── /api/*  → RSVP API + SQLite             │
                 │   └── /*      → static SPA from /app/dist     │
                 └───────────────────────────────────────────────┘
```

- **Frontend** — React 19 + Vite SPA under [`frontend/`](frontend/), styled with
  Tailwind v4 and [shadcn/ui](https://ui.shadcn.com) components on Radix: a per-event
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
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seeds the bootstrap admin (password ≥ 8 chars) |
| `ADMIN_NAME`      | Display name for the seeded admin (default `Admin`) |
| `BETTER_AUTH_SECRET` | Session signing secret (**required in production**; `openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | External origin for session cookies (set behind a proxy) |
| `MAIL_FROM` / `RESEND_API_KEY` | Sender and Resend API key for verification & reset emails (**required in production**) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` | SMTP overrides; default to Resend (`smtp.resend.com:465`, user `resend`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google sign-in; leave blank to hide the button |
| `CORS_ORIGIN`     | Optional cross-origin allow-list (off by default) |
| `PUBLIC_BASE_URL` | Public origin used for canonical / `og:url` / sitemap links (falls back to `BETTER_AUTH_URL`, then the request host) |
| `SEO_ALLOW_INDEXING` | `false` to serve `noindex` + a blanket `Disallow: /` (default: indexable) |
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

## SEO & link previews

Guests mostly arrive by pasting the invitation link into a chat. Those scrapers
(WhatsApp, Messenger, iMessage, Slack, X) and search-engine crawlers never run
the SPA's JavaScript, so the server renders each event's metadata **into the
HTML shell** before sending it ([`server/src/seo.ts`](server/src/seo.ts)):

- `<title>` and `<meta name="description">` built from the event — who, how old,
  when and where, plus whether RSVPs are still open.
- Open Graph and Twitter card tags, so a pasted link previews as
  *"Anniversaire de Léo — 5 ans"* instead of a bare URL, with a generated share
  card as `og:image` (see below).
- `<link rel="canonical">` per invitation (`/` for the default event,
  `/e/<slug>` for the others).
- schema.org `Event` JSON-LD, so the date and place can surface as a rich result.
- `/robots.txt` (keeping crawlers out of `/admin` and `/api/`) and a
  `/sitemap.xml` generated from the events table.
- `noindex, nofollow` on `/admin` and on any slug that matches no event.

Absolute URLs come from `PUBLIC_BASE_URL`, falling back to `BETTER_AUTH_URL` and
then to the (validated) request host. Event text is escaped on the way into the
shell, so an event name can never inject markup.

An invitation is a semi-private page. It stays indexable by default — which is
what the app already did, having had no robots directives at all — but set
`SEO_ALLOW_INDEXING=false` to keep the whole site out of search engines; link
previews keep working either way.

The frontend mirrors the same copy at runtime
([`frontend/src/seo.js`](frontend/src/seo.js)) so the tab title and canonical
stay correct across client-side navigation.

### The share card

A chat preview is mostly picture — the image gets far more room than the title —
so each event has its own card at `/api/og.png` (default event) or
`/api/events/<slug>/og.png`, 1200×630 PNG, themed like the invitation and
carrying the name, age, date and place.

[`server/src/og-image.ts`](server/src/og-image.ts) draws it as SVG and rasterises
it with [resvg](https://github.com/yisibl/resvg-js) (prebuilt binaries, including
musl, so the Alpine image needs no extra build tooling). resvg has no browser
behind it, which shapes three details:

- **Fonts are bundled**, not loaded from Google Fonts like the SPA's — two
  subsetted static instances of Baloo 2, ~43 KB each. See
  [`server/assets/fonts/README.md`](server/assets/fonts/README.md) for how they
  were derived and why a variable font would not do.
- **Emoji are stripped** from event text before drawing: there is no colour-emoji
  font, so `🏠 Chez Léo` would otherwise print a tofu box.
- **Text is measured by estimate**, so a long name shrinks to fit and, past that,
  truncates rather than running off the card.

Rendering costs ~50 ms, so cards are cached in memory keyed by the event's
`updated_at` — an admin's edit invalidates the entry on its own — and served with
an `ETag` plus a one-hour `Cache-Control`.

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
| `GET`    | `/api/events/:slug/og.png`              | —     | Share card (1200×630 PNG) for the event   |

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
| `GET`    | `/api/og.png`             | —     | Share card (PNG), default event          |
| `GET`    | `/api/settings`           | —     | Current UI settings (default theme)      |
| `GET`    | `/api/auth-providers`     | —     | Which sign-in methods are configured     |
| `ALL`    | `/api/auth/*`             | —     | Better Auth (sign-in, sign-up, session)  |
| `GET`    | `/api/me`                 | user  | The signed-in account and its role       |
| `GET`    | `/api/users`              | admin | Every registered account                 |
| `PUT`    | `/api/users/:id/role`     | admin | Grant or revoke the admin role           |
| `DELETE` | `/api/users/:id`          | admin | Delete an account                        |
| `PUT`    | `/api/settings`           | admin | Set the default event's theme            |
| `POST`   | `/api/rsvps`              | admin | Manually add an RSVP (409 on duplicate)  |
| `GET`    | `/api/rsvps`              | admin | All RSVPs (default event)                |
| `GET`    | `/api/rsvps/count`        | admin | Counts (default event)                   |
| `GET`    | `/api/rsvps/export.csv`   | admin | Export RSVPs as CSV (default event)      |
| `PUT`    | `/api/rsvp/:id`           | admin | Edit an RSVP                             |
| `DELETE` | `/api/rsvp/:id`           | admin | Delete an RSVP                           |

### Authentication

Accounts are managed by [Better Auth](https://better-auth.com) with cookie-based
sessions signed by `BETTER_AUTH_SECRET`. Two sign-in methods are available:

- **Email + password** — open self-service registration at `/register`. Sign-up
  sends a confirmation link (Resend SMTP); the account cannot sign in until that
  link is followed. `/forgot-password` sends a reset link over the same transport.
- **Google** — shown at `/login` and `/register` only when `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET` are set. Authorized redirect URI:
  `https://<your-host>/api/auth/callback/google`.

**Registering grants nothing.** Every account starts on the `user` role, which
has no access to events or guest data; the admin API answers `403` with
`code: "not_admin"` and the SPA shows a "pending access" screen. An admin grants
access from the **👥 Accès** panel in `/admin`, which is also where accounts are
demoted or deleted. The role is never accepted from a request body, so a crafted
sign-up cannot self-promote.

`ADMIN_EMAIL` / `ADMIN_PASSWORD` seed the one bootstrap admin on first start.
That account is re-granted the admin role (and marked verified) on every boot, so
a misconfiguration can't leave the deployment with nobody able to sign in. The
guards refuse to demote or delete the acting admin, or to remove the last one.
Demoting an account revokes its sessions immediately. Unauthenticated requests
get `401`. See [`server/README.md`](server/README.md) for request/response details
and the database schema.

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
| `src/auth.ts`    | Better Auth (email/password + Google), roles, admin seed |
| `src/mailer.ts`  | Resend/SMTP transport (nodemailer), no-op when unconfigured |
| `src/emails.ts`  | Verification / password-reset email templates    |
| `src/db.ts`      | Open SQLite (better-sqlite3), schema/migrations  |
| `src/event.ts`   | Event config + `.ics` calendar invite            |
| `src/themes.ts`  | Allow-list of valid theme ids + share-card palettes (mirrors the frontend catalog) |
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
| `src/App.jsx`            | Routes, the admin route guard and the toaster    |
| `src/views/Invitation.jsx` | Per-event invitation, RSVP + lookup (`/`, `/e/:slug`) |
| `src/views/Admin.jsx`    | Multi-event admin: events list, create/edit/theme/share, per-event RSVPs, account access (`/admin`) |
| `src/views/Auth.jsx`     | Sign-in, sign-up, Google, password reset, pending-access |
| `src/session.js`         | Session + role store (`useSession`), read from `/api/me` |
| `src/components/ui/`     | shadcn/ui components (Radix primitives)          |
| `src/env.js`             | Reads runtime config from `window.ENV`           |
| `src/themes.js`          | Theme catalog + `applyTheme` (CSS custom properties) |
| `scripts/check-themes.mjs` | WCAG AA contrast audit of the theme catalog (`npm run check:themes`) |

### Themes

The invitation has a selectable visual theme. The theme belongs to the event,
not the deployment: the admin picks one per event — from the **🎨 Thème** panel
of the event being managed in `/admin`, or from the event's own create/edit
form — and it is stored on that event's row, so every visitor to that
invitation (and its share card) sees it.

| Theme | | Theme | | Theme | |
| --- | --- | --- | --- | --- | --- |
| 🎉 Fiesta | `fiesta` | 🪩 Néon | `neon` | ⚽ Football | `foot` |
| 🕷️ Spider-Man | `spiderman` | 🎮 Gaming | `gaming` | 🧜‍♀️ Sirène | `mermaid` |
| 🤖 Iron Man | `ironman` | 💿 Y2K | `y2k` | 🦁 Safari | `jungle` |
| 🐾 Pat' Patrouille | `pawpatrol` | 🐭 Mickey | `mickey` | 🌸 Manga | `manga` |
| 👑 Princesse | `princess` | 🦖 Dino | `dino` | 🌾 Bohème | `boho` |
| 🚀 Espace | `space` | 🦄 Licorne | `unicorn` | 🛹 Skate | `skate` |

Each theme is pure CSS (palette + emoji + fonts, no image assets) defined in
`frontend/src/themes.js`, applied by writing `--theme-*` CSS custom properties
on `<html>`. Néon, Gaming and Y2K set a dark `cardBg`; `.theme-surface` derives
the shadcn surface tokens from the card colours, so the panel, its inputs and
its outline buttons follow rather than staying white.

Three things keep a growing catalog honest:

- **Contrast.** `npm run check:themes` (in `frontend/`) audits every pair the
  invitation actually stacks — body copy, headings, and the text laid over the
  header, badge and button gradients — against WCAG AA. CI runs it, so a
  palette that reads well as swatches but not as an invitation fails the build.
  A theme that wants a vivid accent alongside a readable header gives the
  header its own `headerFrom`/`headerTo` stops.
- **Sync.** The server-side allow-list and share-card palette in
  `server/src/themes.ts` mirror the frontend catalog; `server/tests/themes.test.ts`
  reads `frontend/src/themes.js` directly and fails when the two drift.
- **Weight.** `index.html` loads only the families needed before a theme is
  known (Fredoka, Nunito, Poppins). Every other typeface is fetched by
  `applyTheme` the first time a theme that uses it is applied, so the catalog
  can grow without every guest paying for it.

The Docker image builds the SPA from this source (multi-stage build), so `dist/`
is never committed. For a full local run, build the frontend once, then start the
backend (`DB_PATH=… node server/server.js`), which serves `../dist`.
