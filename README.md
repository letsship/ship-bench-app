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
  provider, so `pnpm test` needs no Cloudflare account and no Resend account.
  (One exception: `d1.test.ts` builds the native `better-sqlite3` addon to
  smoke-test the Drizzle schema against a real SQLite engine.)

## The repository seam

The linchpin of the architecture is `lib/db/repos/`:

- `types.ts` — the `Repositories` interface (one typed repo per entity).
- `d1.ts` — the production implementation over Drizzle ORM + the Cloudflare D1
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
and a no-op email provider — no D1 binding or Resend account required. Tests use
it implicitly (via `__setTestRepositories`), Playwright runs `next start` with
it, and `pnpm --filter @studiobook/web dev:fake` serves local dev with it. This
is also the fastest local-dev path: the production D1 path needs a Cloudflare
binding, which plain `next dev` doesn't provide.

## Layout

```
apps/web/
  app/                     Next.js App Router (marketing, /login stub, console, api/)
  lib/
    domain/                PURE business logic (capacity, booking rules,
                           invoices, TZ-safe dates, CSV, iCal, reports, money)
    db/
      types.ts             entity types
      schema.ts            Drizzle table definitions (D1/SQLite)
      repos/               the repository seam (types, d1, fakes, mapping)
      seed-data.ts         single-source demo dataset
    notifications/         provider seam (Resend adapter + fake) + outbox
    services/              repository-backed services shared by routes + pages
    auth/                  dev session-cookie stub
  e2e/                     Playwright smoke specs
packages/db/migrations/    raw SQL migrations (Postgres, legacy)
packages/db/migrations/d1/ Drizzle-generated D1/SQLite migrations
supabase/                  Supabase CLI config, retained for the legacy Postgres
                           migrations/seed above (not used by the app itself)
ship.yml                   SHIP preview-deploy manifest
```

## Getting started

Fastest path (no Cloudflare account needed):

```bash
pnpm install
pnpm --filter @studiobook/web dev:fake   # http://localhost:3000, seeded in-memory
```

Against a real D1 database, deployed as a Worker:

```bash
pnpm install
wrangler d1 create studiobook                       # once, then fill in database_id
wrangler d1 migrations apply studiobook --remote     # apply packages/db/migrations/d1
pnpm --filter @studiobook/web preview:cf             # builds with OpenNext, runs via wrangler
```

Plain `next dev` (non-fake) isn't wired up for D1 today — the production repo
implementation resolves its binding through `getCloudflareContext()`, which
needs the Worker runtime `wrangler dev`/`preview:cf` provides.

Sign in at `/login` with any email — the magic-link flow is a **stub** that sets
a signed dev cookie (Studiobook's own auth is separate from any provider auth).

## Common commands

| Command                                                   | What it does                                              |
| --------------------------------------------------------- | --------------------------------------------------------- |
| `pnpm build`                                              | `next build`                                              |
| `pnpm test`                                               | Vitest unit + integration (hermetic, ~180 tests)          |
| `pnpm lint` / `pnpm typecheck`                            | ESLint / `tsc --noEmit`                                   |
| `pnpm --filter @studiobook/web e2e`                       | Playwright smoke (builds, runs `next start` in fake mode) |
| `pnpm --filter @studiobook/web preview:cf`                | build with OpenNext + run locally via wrangler (real D1)  |
| `wrangler d1 migrations apply studiobook`                 | apply `packages/db/migrations/d1` to a D1 database        |
| `pnpm --filter @studiobook/web exec drizzle-kit generate` | regenerate the D1 migration from `lib/db/schema.ts`       |
| `pnpm --filter @studiobook/web db:seed-sql`               | regenerate `supabase/seed.sql` (legacy Postgres seed)     |

## Environment

See `apps/web/.env.example`. D1 is a Worker binding, not an env var, so it needs
no local secret at all — `wrangler`/`opennextjs-cloudflare` resolve it from
`wrangler.jsonc`. `RESEND_API_KEY` is the one real secret and must never be
committed; it's only read when the Resend email client is actually constructed
(so fake mode needs none of it).

## Deploying a preview (Cloudflare)

`ship.yml` wires `.github/workflows/deploy-preview.yml` for SHIP's deploy stage.
On `action=deploy` it ensures the `studiobook` D1 database exists and has every
migration applied (`wrangler d1 create` + `wrangler d1 migrations apply`,
both idempotent), builds with OpenNext, and deploys a `*.workers.dev` Worker,
then sets `RESEND_API_KEY` as a Worker secret; `action=delete` tears the Worker
down on PR close.

> Limitation: preview environments share **one D1 database with production** —
> there is no ephemeral per-PR database (D1 has no lightweight per-branch
> primitive the way the old Supabase Postgres schema pool did).

## Migrations

The production D1/SQLite migrations live in `packages/db/migrations/d1/`,
generated by `drizzle-kit` from `apps/web/lib/db/schema.ts` (config:
`apps/web/drizzle.config.ts`) and applied with
`wrangler d1 migrations apply studiobook --remote`.

`packages/db/migrations/` also still holds the original raw Postgres SQL
(`0001_init.sql`), kept only for the legacy `supabase/` CLI project — it is no
longer part of the app's own persistence path.
