# Agent guide - Studiobook

Read `README.md` for the full project overview. This file is the operating guide
for coding agents working in this repo.

## First pass

- Check `git status --short` before editing. Preserve user changes and generated
  artifacts you did not create.
- Prefer `rg` / `rg --files` for discovery.
- Do not edit generated output: `apps/web/.next/`, `apps/web/.open-next/`,
  `.turbo/`, `dist/`, `next-env.d.ts`, or `*.tsbuildinfo`.
- Keep changes scoped. This repo is a benchmark fixture, so unrelated cleanup
  makes task evaluation noisier.

## Commands

- Install: `pnpm install`
- Full CI gate: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- Unit/integration tests: `pnpm test`
- Local fake-backends dev: `pnpm --filter @studiobook/web dev:fake`
- E2E smoke: `pnpm --filter @studiobook/web e2e`
- Regenerate seed SQL after seed changes: `pnpm --filter @studiobook/web db:seed-sql`

Tests are hermetic. `pnpm test` uses in-memory repositories and fake email; it
does not require D1, Resend, Docker, or network access.

## Architecture seams

- Database access goes through `apps/web/lib/db/repos/`. Route handlers,
  services, pages, and domain code never touch a database binding or driver
  directly.
- Production persistence lives in `apps/web/lib/db/repos/d1.ts` (Drizzle ORM
  over the Cloudflare D1 `DB` binding; table definitions in
  `apps/web/lib/db/repos/schema.ts`); test and fake-dev persistence lives in
  `apps/web/lib/db/repos/fakes.ts`. Keep behavior
  symmetric across both implementations.
- Pure business rules live in `apps/web/lib/domain/`. Keep these modules free of
  framework, database, email, and request concerns.
- Services in `apps/web/lib/services/` compose repositories, domain logic, and
  notification dispatch. They accept `Repositories` by dependency injection.
- API routes in `apps/web/app/api/**/route.ts` use Zod schemas from
  `apps/web/lib/validation.ts`, `handle()` / `HttpError` from
  `apps/web/lib/http.ts`, and return the shared JSON error envelope.
- App Router pages under `apps/web/app/(app)/` resolve data through
  `resolveStudio()` and render with the local component patterns in
  `apps/web/app/(app)/_components/`.
- Email goes through `apps/web/lib/notifications/`: message builders, provider
  seam, fake provider, Resend adapter, and outbox. Domain code never calls
  Resend directly.

## Coding rules

Functional-first, matching the existing code:

- **Pure, small functions.** Avoid side effects; one thing each; ~5-20 lines, 50
  max. Compose small functions instead of large classes; prefer `map`/`filter`/
  `reduce` over imperative loops; `const` + immutable data.
- **Dependency injection.** Service functions receive their `Repositories` and the
  notification provider as arguments (`lib/services/`), never module-level
  singletons — that is what keeps them unit-testable against the fakes.
- **Separation of concerns.** Pure business rules live in `lib/domain/` (no
  framework, database, email, or request imports). Services compose domain +
  repositories + notifications; route handlers and pages orchestrate; components
  present. Domain data (prices, capacity, tax/rounding, invoice status
  transitions) belongs in `lib/domain/` — never inlined in a component or route.
- **KISS + minimal change surface.** Put new logic behind the existing seams, not
  around them; a feature should touch a few files. Extract a shared util (with a
  unit test) rather than duplicating logic. Always `console.error` a swallowed
  error — never a silent catch.

### Cloudflare Workers (MANDATORY)

The app deploys to Cloudflare Workers via OpenNext, which **ends the request
context once the response is sent** — any un-awaited async work is silently
dropped. So NEVER fire-and-forget (`void asyncCall()`, `promise.then(...)` without
`await`) in a route handler, server action, or Server Component. `await` all async
work before returning; wrap non-critical side effects (e.g. sending a
notification) in `try/catch` so a failure logs but does not block the primary
response — as the outbox dispatch does.

### Server actions (MANDATORY)

- Server actions live in `'use server'` modules under `app/**/actions.ts` (see
  `app/(app)/settings/actions.ts`). Page / Server Component files NEVER contain an
  inline `'use server'` closure — keep actions in dedicated modules for reliable
  compilation. Pass them to client components as direct props, or partially apply
  with `.bind(null, ctx)` (bound args first).

### Input validation — Zod (MANDATORY)

- ALL external data is validated with Zod at the boundary (route handlers, server
  actions, any untyped external object). NEVER `as`-cast external input — parse it.
  Request schemas are centralized in `apps/web/lib/validation.ts` (e.g.
  `createBookingSchema`); `parse` inside `handle()` (which returns the shared JSON
  error envelope on failure) and `safeParse` where you branch on validity.

### Test integrity (MANDATORY)

- NEVER skip, `.fixme`, or comment out a test to make a suite pass — every test
  runs and passes (0 failed, 0 skipped). Fix the root cause, not the symptom. The
  CI gate is `verify` (lint + typecheck + unit/integration + build) AND `e2e`
  (Playwright journeys); both must be green. Unit/integration tests are hermetic
  (in-memory repositories + fake email — no D1, Resend, Docker, or network).

## Data and migrations

- The D1 schema ships as raw SQL in `apps/web/migrations/` (the wrangler D1
  migrations directory, wired via `migrations_dir` in `wrangler.jsonc`). The
  legacy Postgres schema it mirrors lives in `packages/db/migrations/`.
- App entities are camelCase TypeScript types in `apps/web/lib/db/types.ts`; D1
  columns are snake_case, mapped 1:1 by the Drizzle table definitions in
  `apps/web/lib/db/repos/schema.ts`.
- Services set ids and timestamps app-side so D1 and fake repositories
  behave the same way.
- If seed data changes, update `apps/web/lib/db/seed-data.ts` and regenerate
  `supabase/seed.sql`.

## Environment and deploy

- Email env vars (`RESEND_API_KEY`, `STUDIOBOOK_FROM_EMAIL`) are read directly
  via `process.env` in `apps/web/lib/notifications/provider.ts`. Fake-backends
  mode needs no secrets at all.
- Never commit secrets. Use `.env.local`, GitHub
  secrets, or Wrangler secrets as appropriate.
- Cloudflare Worker deploy uses OpenNext with `apps/web/wrangler.jsonc` and
  `apps/web/wrangler.preview.jsonc`. Preview deploy orchestration is in
  `ship.yml` and `.github/workflows/deploy-preview.yml`.

## Repo-local skills and prompts

Use repo skills in `.agents/skills/` when a task matches their description:

- `studiobook-codebase` for orientation and source maps.
- `studiobook-feature-workflow` for product/API/UI changes.
- `studiobook-data-and-migrations` for schema, repository, seed, or D1 work.
- `studiobook-notifications` for email/outbox work.
- `studiobook-deploy-preview` for OpenNext, Wrangler, SHIP, and preview deploys.
- `posthog-nextjs` for PostHog analytics, flags, and experiments.
- `playwright-e2e` for writing, running, and debugging the E2E user-journey tests.
- Existing Cloudflare skills cover Workers best practices, Wrangler, and
  Cloudflare Email Service.

Prompt templates for common agent tasks live in `.agents/prompts/`.

## Vendor docs

Offline vendor references live in `docs/vendor/`. Prefer them for deterministic
work unless a task explicitly requires latest live docs.

## Conventions

TypeScript is strict. Match surrounding code, Prettier formatting, and the
existing test style. Add or update focused tests when behavior changes; broaden
coverage when touching shared seams.
