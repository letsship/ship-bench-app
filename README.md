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
- **Database**: **Cloudflare D1** (SQLite, accessed via **Drizzle ORM**). All
  data access goes through thin **repositories** (`lib/db/repos/`); route
  handlers and domain logic never touch Drizzle or the D1 binding directly.
- **Email**: the real **Resend** SDK, behind a provider-agnostic notification
  adapter + an outbox table.
- **Deploy**: `@opennextjs/cloudflare` to a Cloudflare Worker.
- **Tests**: Vitest (unit + integration) and Playwright (browser smoke), both
  fully hermetic — they run against in-memory repository fakes + a fake email
  provider, so `pnpm test` needs no D1, no Resend, and no native modules.

## The repository seam

The linchpin of the architecture is `lib/db/repos/`:

- `types.ts` — the `Repositories` interface (one typed repo per entity).
- `d1.ts` — the production implementation over Drizzle + the Cloudflare D1
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
      schema.ts             Drizzle sqlite schema (mirrors packages/db/migrations)
      repos/               the repository seam (types, d1, fakes, mapping)
      seed-data.ts         single-source demo dataset
    notifications/         provider seam (Resend adapter + fake) + outbox
    services/              repository-backed services shared by routes + pages
    auth/                  dev session-cookie stub
    env.ts                 Zod-validated environment access
  drizzle.config.ts        drizzle-kit config for regenerating D1 migrations
  wrangler.jsonc           Worker config: assets + D1 binding
  e2e/                     Playwright smoke specs
packages/db/migrations/    raw SQL migrations (D1 / SQLite)
ship.yml                   SHIP preview-deploy manifest
```

## Getting started

Fastest path (no D1 needed):

```bash
pnpm install
pnpm --filter @studiobook/web dev:fake   # http://localhost:3000, seeded in-memory
```

Against a real local D1 database:

```bash
pnpm install
wrangler d1 create studiobook   # once — paste the printed database_id into wrangler.jsonc
wrangler d1 migrations apply studiobook --local   # applies packages/db/migrations
pnpm --filter @studiobook/web dev   # resolves the D1 binding locally via Miniflare
```

Sign in at `/login` with any email — the magic-link flow is a **stub** that sets
a signed dev cookie (Studiobook's auth is separate from the database layer).

## Common commands

| Command                                                   | What it does                                              |
| --------------------------------------------------------- | --------------------------------------------------------- |
| `pnpm build`                                              | `next build`                                              |
| `pnpm test`                                               | Vitest unit + integration (hermetic, ~180 tests)          |
| `pnpm lint` / `pnpm typecheck`                            | ESLint / `tsc --noEmit`                                   |
| `pnpm --filter @studiobook/web e2e`                       | Playwright smoke (builds, runs `next start` in fake mode) |
| `wrangler d1 migrations apply studiobook --local`         | apply pending migrations to the local D1 db               |
| `pnpm --filter @studiobook/web exec drizzle-kit generate` | regenerate D1 migrations from `lib/db/schema.ts`          |
| `pnpm --filter @studiobook/web db:seed-sql`               | regenerate `packages/db/seed.sql`                         |

## Environment

See `apps/web/.env.example`. Persistence needs no env vars — D1 is a Worker
binding, resolved via `getCloudflareContext().env.DB` in production and via
Miniflare (see `next.config.ts`) in local `next dev`. `RESEND_API_KEY` is the
only secret and must never be committed. Env is validated with Zod in
`lib/env.ts` and only read when an email client is actually constructed (so
fake mode needs none of it).

## Deploying a preview (Cloudflare)

`ship.yml` wires `.github/workflows/deploy-preview.yml` for SHIP's deploy stage.
On `action=deploy` it builds with OpenNext and deploys a `*.workers.dev` Worker,
then sets `RESEND_API_KEY` as a Worker secret; `action=delete` tears the Worker
down on PR close.

> Limitation: preview environments share **one seeded D1 database** — there is
> no ephemeral per-PR database. Point the workflow's `RESEND_API_KEY` GitHub
> secret and the preview D1 binding at a dedicated preview database.

## Migrations

Migrations are raw SQL in `packages/db/migrations/`, numbered sequentially
(`0001_init.sql`), applied via `wrangler d1 migrations apply`. The Drizzle
schema (`apps/web/lib/db/schema.ts`) mirrors these columns 1:1; regenerate a new
migration from schema changes with `drizzle-kit generate`, or hand-write one
following the existing numbering. Seed data lives in `packages/db/seed.sql`,
generated from the app's own demo dataset — run `db:seed-sql` to refresh it.
