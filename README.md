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
- **Database**: **Cloudflare D1** (SQLite) via **Drizzle ORM**. All data
  access goes through thin **repositories** (`lib/db/repos/`); route handlers and
  domain logic never touch Drizzle or the D1 binding directly.
- **Email**: the real **Resend** SDK, behind a provider-agnostic notification
  adapter + an outbox table.
- **Deploy**: `@opennextjs/cloudflare` to a Cloudflare Worker.
- **Tests**: Vitest (unit + integration) and Playwright (browser smoke), both
  fully hermetic — they run against in-memory repository fakes + a fake email
  provider, so `pnpm test` needs no Supabase, no Resend, and no native modules.

## The repository seam

The linchpin of the architecture is `lib/db/repos/`:

- `types.ts` — the `Repositories` interface (one typed repo per entity).
- `d1.ts` — the production implementation over Drizzle ORM + Cloudflare D1.
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
      schema.ts            Drizzle sqliteTable schema (D1)
      repos/               the repository seam (types, d1, fakes)
      seed-data.ts         single-source demo dataset
    notifications/         provider seam (Resend adapter + fake) + outbox
    services/              repository-backed services shared by routes + pages
    auth/                  dev session-cookie stub
    env.ts                 Zod-validated environment access
  e2e/                     Playwright smoke specs
  migrations/              drizzle-kit-generated D1/SQLite migrations
packages/db/migrations/    raw SQL migrations (Postgres, legacy reference)
supabase/                  legacy Supabase CLI config (unused by the app)
ship.yml                   SHIP preview-deploy manifest
```

## Getting started

Fastest path (no Supabase needed):

```bash
pnpm install
pnpm --filter @studiobook/web dev:fake   # http://localhost:3000, seeded in-memory
```

Against a real local D1 database (via `wrangler`'s local simulation):

```bash
pnpm install
pnpm --filter @studiobook/web preview:cf   # builds with OpenNext, runs under wrangler + local D1
```

Sign in at `/login` with any email — the magic-link flow is a **stub** that sets
a signed dev cookie (Studiobook's own auth is separate from Supabase Auth).

## Common commands

| Command                                       | What it does                                                         |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm build`                                  | `next build`                                                         |
| `pnpm test`                                   | Vitest unit + integration (hermetic, ~180 tests)                     |
| `pnpm lint` / `pnpm typecheck`                | ESLint / `tsc --noEmit`                                              |
| `pnpm --filter @studiobook/web e2e`           | Playwright smoke (builds, runs `next start` in fake mode)            |
| `pnpm supabase:start` / `pnpm supabase:reset` | boot local Supabase / apply migrations + seed                        |
| `pnpm supabase:migrate`                       | apply pending migrations to the running local db                     |
| `pnpm supabase:types`                         | regenerate `apps/web/lib/db/database.types.ts` from the local schema |
| `pnpm --filter @studiobook/web db:seed-sql`   | regenerate `supabase/seed.sql`                                       |

## Environment

See `apps/web/.env.example`. `RESEND_API_KEY` is a secret and must never be
committed. The D1 database is a Worker **binding** (`DB` in `wrangler.jsonc`),
not an env var. Env is validated with Zod in `lib/env.ts` and only read when
the email client is actually constructed (so fake mode needs none of it).

## Deploying a preview (Cloudflare)

`ship.yml` wires `.github/workflows/deploy-preview.yml` for SHIP's deploy stage.
On `action=deploy` it builds with OpenNext (Supabase URL + publishable key
injected at build time) and deploys a `*.workers.dev` Worker, then sets
`SUPABASE_SECRET_KEY` + `RESEND_API_KEY` as Worker secrets; `action=delete` tears
the Worker down on PR close.

> Limitation: preview environments share **one seeded Supabase project** — there
> is no ephemeral per-PR database. Point the workflow's `SUPABASE_*` /
> `RESEND_API_KEY` GitHub secrets at a dedicated preview project.

## Migrations

Production migrations are SQLite in `apps/web/migrations/`, generated from the
Drizzle schema (`apps/web/lib/db/schema.ts`) via `pnpm --filter @studiobook/web
db:generate`, and applied to the D1 binding with `wrangler d1 migrations apply`.
`packages/db/migrations/` holds the legacy raw Postgres schema for reference;
it's no longer used by the app.
