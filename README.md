# Studiobook

A class-booking and studio-management app for movement studios (yoga, pilates,
pottery). Members, a class schedule with live occupancy and waitlists,
invoicing with tax and refunds, monthly revenue reports, a public iCalendar
feed, and CSV exports — all backed by a real database and a thorough test suite.

Studiobook is the **benchmark fixture** for
[SWE-in-a-team](https://letsship.ai/blog/swe-in-a-team), SHIP's
software-delivery benchmark: a realistic, working, tested codebase that
autonomous agents are asked to modify. Everything here is hand-authored.

## Stack

- **Monorepo**: pnpm workspaces + Turborepo. One app, `apps/web`.
- **Web**: Next.js 16 (App Router, React 19), TypeScript strict, Tailwind v4.
- **Database**: **Supabase** (Postgres 17 + `@supabase/supabase-js`). All data
  access goes through thin **repositories** (`lib/db/repos/`); route handlers and
  domain logic never touch supabase-js directly.
- **Email**: the real **Resend** SDK, behind a provider-agnostic notification
  adapter + an outbox table.
- **Deploy**: `@opennextjs/cloudflare` to a Cloudflare Worker.
- **Tests**: Vitest (unit + integration) and Playwright (browser smoke), both
  fully hermetic — they run against in-memory repository fakes + a fake email
  provider, so `pnpm test` needs no Supabase, no Resend, and no native modules.

## The repository seam

The linchpin of the architecture is `lib/db/repos/`:

- `types.ts` — the `Repositories` interface (one typed repo per entity).
- `supabase.ts` — the production implementation over supabase-js.
- `fakes.ts` — an in-memory implementation for tests + the local fake-backends
  mode.
- `index.ts` — `resolveRepositories()` picks the implementation.

Services (`lib/services/`) take `Repositories` by dependency injection and
compose it with the pure domain logic (`lib/domain/`). Swapping the persistence
layer means writing a new set of repositories — nothing above the interface
changes.

## Fake-backends mode

Set `USE_FAKE_BACKENDS=1` to run the whole app against a seeded in-memory store
and a no-op email provider — no Supabase or Resend account required. Tests use it
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
      repos/               the repository seam (types, supabase, fakes, mapping)
      seed-data.ts         single-source demo dataset
    supabase/              @supabase/ssr + service-role client factories
    notifications/         provider seam (Resend adapter + fake) + outbox
    services/              repository-backed services shared by routes + pages
    auth/                  dev session-cookie stub
    env.ts                 Zod-validated environment access
  e2e/                     Playwright smoke specs
packages/db/migrations/    raw SQL migrations (Postgres)
supabase/                  Supabase CLI config (migrations symlinks packages/db)
ship.yml                   SHIP preview-deploy manifest
```

## Getting started

Fastest path (no Supabase needed):

```bash
pnpm install
pnpm --filter @studiobook/web dev:fake   # http://localhost:3000, seeded in-memory
```

Against a real local Supabase:

```bash
pnpm install
pnpm supabase:start    # boots the local Supabase stack (Docker)
pnpm supabase:reset    # applies packages/db/migrations + seeds supabase/seed.sql
# set NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY / SUPABASE_SECRET_KEY (see .env.example)
pnpm --filter @studiobook/web dev
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

See `apps/web/.env.example`. The Supabase URL + publishable key are public;
`SUPABASE_SECRET_KEY` and `RESEND_API_KEY` are secrets and must never be
committed. Env is validated with Zod in `lib/env.ts` and only read when a
Supabase/email client is actually constructed (so fake mode needs none of it).

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

Migrations are raw SQL in `packages/db/migrations/`, numbered sequentially
(`0001_init.sql`). `supabase/migrations` is a symlink to that directory, so
`supabase db reset` applies them and then seeds from `supabase/seed.sql` (which
is generated from the app's own seed data — run `db:seed-sql` to refresh it).
