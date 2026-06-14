# 🎉 Birthday Invitation

A small self-hosted birthday invitation web app with online RSVP. A single-page
frontend shows the event details (who, when, where, dress code) and lets guests
confirm their attendance; a Node.js/Express backend stores RSVPs in SQLite.

Deployed on the homelab as `wifsimster/birthday-invitation` behind Traefik at
`leo-birthday.${DOMAIN}`.

> ⚠️ **Provenance:** this repository was reconstructed from the published Docker
> image. The original **Vite frontend source was not available**, so the compiled
> SPA is committed as-is under [`dist/`](dist/). The **backend** under
> [`server/`](server/) is full source. If you have the original frontend sources,
> drop them in (e.g. a `frontend/` folder) and adjust the [`Dockerfile`](Dockerfile)
> to build them.

## Architecture

```
                 ┌──────────────── container (port 3000) ────────────────┐
  browser ─────► │  Caddy                                                 │
                 │   ├── /api/*   → reverse_proxy → Node backend :3001    │
                 │   └── /*       → static SPA from /app/dist             │
                 │                                                        │
                 │  supervisord manages: caddy + node                     │
                 └────────────────────────────────────────────────────────┘
```

- **Frontend** — Vite SPA (built assets in `dist/`). Event details are injected
  at container start into `dist/env.js` by [`infra/inject-env.sh`](infra/inject-env.sh)
  from environment variables, so the same image works for any event.
- **Backend** — Express 5 API with SQLite, rate limiting, Helmet, input
  validation and IP-based duplicate prevention. See [`server/README.md`](server/README.md).
- **Process management** — [`infra/supervisord.conf`](infra/supervisord.conf)
  runs Caddy and Node; [`infra/Caddyfile`](infra/Caddyfile) handles routing.

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
| `DOMAIN`          | Base domain for the Traefik router         |

## Run with Docker

```bash
cp .env.example .env   # edit values
docker compose up -d
```

`compose.yml` pulls the published image and wires up the Traefik router. To build
locally instead, point the service at the included [`Dockerfile`](Dockerfile).

## API

| Method | Endpoint           | Description                          |
| ------ | ------------------ | ------------------------------------ |
| `GET`  | `/api/health`      | Health check                         |
| `GET`  | `/api/rsvps`       | All RSVPs (admin)                    |
| `GET`  | `/api/rsvps/count` | Confirmation and guest counts        |
| `POST` | `/api/rsvp`        | Submit an RSVP                       |

See [`server/README.md`](server/README.md) for request/response details and the
database schema.

## Backend development

```bash
cd server
npm install
npm run dev    # node --watch
npm test       # vitest
```
