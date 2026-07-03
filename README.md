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
- **Database**: Drizzle ORM over SQLite — Cloudflare **D1** in production, a
  local **better-sqlite3** file for dev / `next start` / tests.
- **Deploy**: `@opennextjs/cloudflare` to a Cloudflare Worker.
- **Tests**: Vitest (unit + integration) and Playwright (browser smoke).

## Layout

```
apps/web/
  app/                     Next.js App Router
    (marketing)            landing "/" + "/login" (magic-link STUB)
    (app)/                 authed console: dashboard, classes, bookings,
                           members, invoices, invoices/[id], settings, reports
    api/                   route handlers: classes, bookings, members,
                           invoices, ical, export
  lib/
    domain/                PURE business logic (capacity, booking rules,
                           invoices, TZ-safe dates, CSV, iCal, reports, money)
    db/                    Drizzle schema, client, seed data + tooling
    notifications/         provider seam (mailjay SDK + adapter) + outbox
    services/              DB-backed services shared by routes and pages
    auth/                  dev session-cookie stub
  drizzle/                 generated migrations + seed.sql
  e2e/                     Playwright smoke specs
packages/config-typescript/  shared tsconfig bases
ship.yml                     SHIP preview-deploy manifest
```

## Getting started

```bash
pnpm install            # builds the better-sqlite3 native binding automatically
pnpm --filter @studiobook/web db:reset   # migrate + seed a local sqlite db
pnpm --filter @studiobook/web dev        # http://localhost:3000
```

Sign in at `/login` with any email — the magic-link flow is a **stub** that sets
a signed dev cookie (there is no real email or identity provider).

## Common commands

Run from the repo root (Turborepo fans them out):

| Command | What it does |
|---|---|
| `pnpm build` | `next build` |
| `pnpm test` | Vitest unit + integration suite |
| `pnpm lint` / `pnpm typecheck` | ESLint / `tsc --noEmit` |
| `pnpm --filter @studiobook/web e2e` | Playwright smoke (builds, seeds, `next start`, runs specs) |
| `pnpm --filter @studiobook/web db:reset` | Drop, migrate, and reseed the local db |
| `pnpm --filter @studiobook/web db:generate` | Regenerate Drizzle migrations from the schema |
| `pnpm --filter @studiobook/web db:emit-seed-sql` | Regenerate `drizzle/seed.sql` |

The local database path is `apps/web/.data/studiobook.db` by default; override
with `STUDIOBOOK_DB_PATH`.

## Domain logic

The pure functions in `lib/domain/*` are the heart of the app and carry the most
tests:

- **capacity** — occupancy math (which booking statuses hold a seat, waitlist).
- **booking-rules** — whether a member may book/cancel, waitlist promotion, and
  refund eligibility against the studio's cancellation window.
- **invoices** — subtotal/tax/total from line items, refunds, status transitions.
- **dates** — timezone-safe day/month bucketing (studios store UTC; the schedule
  and reports bucket in the studio's IANA timezone).
- **csv / ical** — RFC-correct exports (quoting, line folding, escaping).
- **reports** — monthly revenue recognised from invoices.

## Notification provider seam

`lib/notifications/` isolates all email behind a `NotificationProvider`
interface. The only concrete adapter today is **mailjay** — a self-contained
(fictional) vendor SDK in `mailjay-sdk.ts` with an injectable transport that
defaults to an in-memory recorder, so the app sends "notifications" with no
vendor account. Notifications are written to a `notification_outbox` table and
delivered by a dispatcher that honours per-member and per-studio opt-outs.

## Deploying a preview (Cloudflare)

`ship.yml` wires `.github/workflows/deploy-preview.yml` for SHIP's deploy stage.
On `action=deploy` it provisions an ephemeral per-PR D1 database, applies
migrations, seeds it from `drizzle/seed.sql`, builds with OpenNext, and deploys a
`*.workers.dev` Worker; `action=delete` tears both down on PR close. Deploying
outside SHIP needs a Cloudflare account with `CLOUDFLARE_API_TOKEN` +
`CLOUDFLARE_ACCOUNT_ID` and a D1 database bound as `DB` (see
`apps/web/wrangler.jsonc`).

> Note: `drizzle/seed.sql` is a snapshot with dates anchored to when it was
> generated. Run `db:emit-seed-sql` to refresh it so preview demos land on the
> current week.
