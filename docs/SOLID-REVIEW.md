# SOLID review

An assessment of this codebase against the five SOLID principles, the score it
earned, and what was changed to raise it. Scores are out of 5.

| Principle | Before | After |
| --- | --- | --- |
| **S** — Single responsibility | 2.0 | 4.7 |
| **O** — Open/closed | 3.0 | 4.6 |
| **L** — Liskov substitution | 4.5 | 4.8 |
| **I** — Interface segregation | 3.0 | 4.5 |
| **D** — Dependency inversion | 3.0 | 4.7 |
| **Overall** | **3.1** | **4.66** |

---

## Before

Four files held most of the application:

| File | Lines | What it did |
| --- | --- | --- |
| `frontend/src/views/Admin.jsx` | 2198 | fetches, URLs, polling, filters, four tabs, five dialogs |
| `server/src/app.ts` | 1480 | middleware, validation, authorisation, SQL, domain rules, serialisation, caching, static serving, error handling |
| `frontend/src/views/Invitation.jsx` | 1192 | fetching, countdown, SEO, two forms, guest list, layout |
| `frontend/src/views/Auth.jsx` | 478 | four flows, two dead ends, Better Auth error codes |

### S — Single responsibility: 2.0

`createApp` was a single function with at least eight reasons to change. A new
column, a new rate limit, a new French error message, a change to the CSP and a
change to the RSVP rules all edited the same file. `Admin.jsx` was the same
shape on the client.

The cost was not hypothetical. The legacy un-slugged RSVP routes and the
event-scoped ones were copies of each other — the same insert, the same
conflict check, the same consent rule, written twice — so the two had already
drifted on how a decline's guest count was normalised.

### O — Open/closed: 3.0

The migration list was genuinely open for extension (append-only, version
tracked), and the rate limits were injectable. Everything else required editing
existing code: a new endpoint went into the middle of `createApp`, a new
sign-in flow meant nine new `mode === …` branches in `Auth.jsx`, and a third
"are you sure?" dialog meant a third copy of the same markup.

### L — Liskov substitution: 4.5

Little inheritance, so little to violate. The `Db` and `Mailer` factories
returned honest implementations of their interfaces. The no-op mailer does not
send mail, but it says so through `enabled` rather than pretending.

### I — Interface segregation: 3.0

Route handlers received a `Db` exposing `run`/`get`/`all` plus `raw` — the whole
SQLite handle. Every consumer therefore depended on arbitrary SQL and on the
schema, when what each one actually needed was between two and six named
operations.

### D — Dependency inversion: 3.0

Composition was already good at the edges: `createApp` took its database,
auth, logger and mailer as parameters with sensible defaults, which is why the
tests could run the real routes against an in-memory database. But inside, the
policy was written directly against the detail — SQL strings in route handlers,
`fetch` with hand-built URLs in components, Better Auth's HTTP status codes in
the sign-in view.

---

## After

47 server modules and 51 frontend modules (excluding generated shadcn/ui
primitives). The largest file is 694 lines; the median is under 90.

### Server

```
src/
  app.ts            composition root — 137 lines of wiring, no rules
  domain/           the rules, with no Express and no SQL
    event.ts        config, slug, RSVP deadline, calendar invite
    rsvp.ts         phone normalisation, guest count, sharing consent
    access.ts       who may manage which invitation
    errors.ts       DomainError — says what went wrong, not which status code
  repositories/     one narrow port per aggregate + its SQLite adapter
  services/         the use-cases, depending on those ports
  http/             guards, validation, presenters, CSV, limits, headers,
                    and the single place a DomainError becomes a status code
  routes/           seven routers, one slice of the API each
  seo/              metadata model, shell injection, robots/sitemap
  migrations.ts     schema history, out of the connection module
```

### Frontend

```
src/
  api/              one client; endpoints named as functions, never URLs in views
  hooks/            useEvents, useEventRsvps, useUsers, useGuestList,
                    useInvitationEvent, useRsvpFlow, useCountdown, usePoll,
                    useHotkey, useSessionRecovery
  views/admin/      a component per region + shared ConfirmDialog/PanelState
  views/invitation/ hero, countdown, forms, guest list, details, share
  views/auth/       flows described as data (modes.js) + the form that renders them
```

### S — 4.7

Each module has one reason to change. The RSVP rules live in
`domain/rsvp.ts`; both HTTP surfaces reach them through one service, so the
duplication that let them drift is gone. `Admin.jsx` is 694 lines of
orchestration — which event is selected, which tab is open, which dialog is up —
and nothing else.

Not perfect: `og-image.ts` still derives the card's content, lays out the SVG
and rasterises it in one module. They are cohesive enough (one artefact, one
reason to change: the card's design) that splitting them would cost more than
it pays.

### O — 4.6

- A new endpoint is a new router, mounted in `app.ts`; no existing route changes.
- A different store means implementing four small interfaces, with no service
  or route touched.
- A fifth sign-in flow is one entry in `modes.js`.
- Another destructive action passes different props to the existing
  `ConfirmDialog`.
- Migrations remain append-only.

A second role still means editing `domain/access.ts` — but that is now the one
place it is decided, rather than eleven inline `role === 'admin'` checks.

### L — 4.8

The repository ports are implemented twice in practice: by SQLite adapters in
production and by array-backed fakes in `tests/services.test.ts`. The services
cannot tell the difference, which is the substitution property demonstrated
rather than asserted.

### I — 4.5

`EventRepository`, `RsvpRepository`, `UserRepository` and `SettingsRepository`
each list only what their callers need — `SettingsRepository` has exactly one
method. Routers receive `Pick<>` subsets of the dependency bag; the SPA router
takes two event-repository methods, not the repository.

`Db` still exposes `raw`, because Better Auth manages its own tables through
the underlying handle. It is now reached only by the composition root and the
repositories.

### D — 4.7

High-level policy depends on abstractions throughout: services on repository
interfaces, routes on services, components on `api/` and hooks. The concrete
choices — SQLite, Express, Better Auth, `fetch` — are named in the composition
root and in the adapters. `api/auth-actions.js` is an anti-corruption layer:
Better Auth's `{ error: { status: 403 } }` becomes this app's
`{ verified: false }`, so no view branches on an HTTP status.

---

## Verification

Behaviour is unchanged, and was checked three ways:

- **180 existing server tests pass untouched.** They drive the real routes over
  HTTP against an in-memory database, so they would fail on any change to a
  status code, a payload or a French message.
- **14 new service tests** drive the use-cases against hand-written fakes of the
  repository interfaces — no Express, no SQLite, 0.5s instead of 20. They exist
  as much to prove the seams as to check the rules: a service that reached past
  its port for a database handle would stop compiling.
- **26 browser flows** against the real server and the built SPA: a guest
  submits, retrieves and edits an answer; the guest list honours consent in both
  directions; the console signs in, filters, edits, creates and deletes across
  all four tabs; and all four auth flows plus both dead ends behave, including
  the unverified-account path and an invalid reset token.

`tsc --noEmit` and `eslint` are clean, and the theme contrast audit still
passes.
