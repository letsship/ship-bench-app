# Studiobook

A class-booking and studio-management app for movement studios (yoga, pilates,
pottery). Members, a class schedule with live occupancy and waitlists,
invoicing with tax and refunds, monthly revenue reports, a public iCalendar
feed, and CSV exports — all backed by a real database and a thorough test suite.

Studiobook is a **benchmark fixture** for SHIP's software-delivery pipeline: a
realistic, working, tested codebase that autonomous agents are asked to modify.
Everything here is hand-authored.

## Stack

- **Monorepo**: pnpm workspaces + Turborepo. One app, `apps/web`.
- **Web**: Next.js 16 (App Router, React 19), TypeScript strict, Tailwind v4.
- **Database**: **Cloudflare D1** (SQLite) via **Drizzle ORM**. All data access
  goes through thin **repositories** (`lib/db/repos/`); route handlers and
  domain logic never touch Drizzle or the D1 binding directly.
- **Email**: the real **Resend** SDK, behind a provider-agnostic notification
  adapter + an outbox table.
- **Deploy**: `@opennextjs/cloudflare` to a Cloudflare Worker.
- **Tests**: Vitest (unit + integration) and Playwright (browser smoke), both
  fully hermetic — they run against in-memory repository fakes + a fake email
  provider, so `pnpm test` needs no D1, no Resend, and no native modules.

## The repository seam

The linchpin of the architecture is `lib/db/repos/`:

- `types.ts` — the `Repositories` interface (one typed repo per entity).
- `d1.ts` — the production implementation, Drizzle ORM over the Cloudflare D1
  binding.
- `fakes.ts` — an in-memory implementation for tests + the local fake-backends
  mode.
- `index.ts` — `resolveRepositories()` picks the implementation.

Services (`lib/services/`) take `Repositories` by dependency injection and
compose it with the pure domain logic (`lib/domain/`). Swapping the persistence
layer means writing a new set of repositories — nothing above the interface
changes.

## Fake-backends mode

Set `USE_FAKE_BACKENDS=1` to run the whole app against a seeded in-memory store
and a no-op email provider — no D1 or Resend account required. Tests use it
implicitly (via `__setTestRepositories`), Playwright runs `next start` with it,
and `pnpm --filter @studiobook/web dev:fake` serves local dev with it.

## Layout

```
apps/web/
  app/                     Next.js App Router (marketing, /login stub, console, api/)
  lib/
    domain/                PURE business logic (capacity, booking rules,
                           invoices, TZ-safe dates, CSV, iCal, reports, money)
    db/
      types.ts             entity types
      schema.ts            Drizzle table definitions (mirrors migrations/)
      repos/               the repository seam (types, d1, fakes, mapping)
      seed-data.ts         single-source demo dataset
    notifications/         provider seam (Resend adapter + fake) + outbox
    services/              repository-backed services shared by routes + pages
    auth/                  dev session-cookie stub
    env.ts                 Zod-validated environment access
  e2e/                     Playwright smoke specs
  migrations/              raw SQL migrations (SQLite / D1)
  seed.sql                 demo dataset as D1-flavoured INSERT statements
ship.yml                   SHIP preview-deploy manifest
```

## Getting started

Fastest path (no Cloudflare account needed):

```bash
pnpm install
pnpm --filter @studiobook/web dev:fake   # http://localhost:3000, seeded in-memory
```

Against a real local D1 database (via `wrangler`/Miniflare):

```bash
pnpm install
pnpm exec wrangler d1 execute studiobook --local --file=apps/web/migrations/0001_init.sql
pnpm exec wrangler d1 execute studiobook --local --file=apps/web/seed.sql
pnpm --filter @studiobook/web dev
```

Sign in at `/login` with any email — the magic-link flow is a **stub** that sets
a signed dev cookie (Studiobook's own auth is a dev-cookie stub, unrelated to
persistence).

## Common commands

| Command                                     | What it does                                              |
| ------------------------------------------- | --------------------------------------------------------- |
| `pnpm build`                                | `next build`                                              |
| `pnpm test`                                 | Vitest unit + integration (hermetic, ~180 tests)          |
| `pnpm lint` / `pnpm typecheck`              | ESLint / `tsc --noEmit`                                   |
| `pnpm --filter @studiobook/web e2e`         | Playwright smoke (builds, runs `next start` in fake mode) |
| `pnpm --filter @studiobook/web cf-typegen`  | regenerate Cloudflare binding types (`wrangler types`)    |
| `pnpm --filter @studiobook/web db:seed-sql` | regenerate `apps/web/seed.sql` from the app's seed data   |

## Environment

See `apps/web/.env.example`. `RESEND_API_KEY` is a secret and must never be
committed. Env is validated with Zod in `lib/env.ts` and only read when the
email client is actually constructed (so fake mode needs none of it).
Persistence needs no env var: the D1 binding (`DB`) is configured in
`wrangler.jsonc` / `wrangler.preview.jsonc`.

## Deploying a preview (Cloudflare)

`ship.yml` wires `.github/workflows/deploy-preview.yml` for SHIP's deploy stage.
On `action=deploy` it applies migrations and reseeds the demo dataset against
the preview D1 database, builds with OpenNext, deploys a `*.workers.dev`
Worker, then sets `RESEND_API_KEY` as a Worker secret; `action=delete` tears
the Worker down on PR close.

> Limitation: preview environments share **one D1 database** — there is no
> ephemeral per-PR database. Every deploy reseeds it fresh from
> `apps/web/seed.sql`, so concurrent preview deploys can race each other's data.

## Migrations

Migrations are raw SQL in `apps/web/migrations/`, numbered sequentially
(`0001_init.sql`), applied to the D1 binding via `wrangler d1 migrations apply`
(local) or automatically on deploy (`migrations_dir` in `wrangler.jsonc`).
`apps/web/lib/db/schema.ts` declares the same tables for Drizzle. The demo
dataset lives in `apps/web/seed.sql`, generated from the app's own seed data —
run `pnpm --filter @studiobook/web db:seed-sql` to refresh it.
