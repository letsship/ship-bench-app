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
does not require Supabase, Resend, Docker, or network access.

## Architecture seams

- Database access goes through `apps/web/lib/db/repos/`. Route handlers,
  services, pages, and domain code never import `@supabase/supabase-js`.
- Production persistence lives in `apps/web/lib/db/repos/supabase.ts`; test and
  fake-dev persistence lives in `apps/web/lib/db/repos/fakes.ts`. Keep behavior
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

## Data and migrations

- Raw SQL migrations live in `packages/db/migrations/`. `supabase/migrations` is
  a symlink to that directory.
- App entities are camelCase TypeScript types in `apps/web/lib/db/types.ts`;
  Supabase rows are snake_case and mapped only in `apps/web/lib/db/repos/mapping.ts`.
- Services set ids and timestamps app-side so Supabase and fake repositories
  behave the same way.
- If seed data changes, update `apps/web/lib/db/seed-data.ts` and regenerate
  `supabase/seed.sql`.

## Environment and deploy

- Env access is Zod-validated and lazy in `apps/web/lib/env.ts`. Fake-backends
  mode should not need Supabase or email secrets.
- Never commit secrets. Use `.env.local`, Supabase CLI local config, GitHub
  secrets, or Wrangler secrets as appropriate.
- Cloudflare Worker deploy uses OpenNext with `apps/web/wrangler.jsonc` and
  `apps/web/wrangler.preview.jsonc`. Preview deploy orchestration is in
  `ship.yml` and `.github/workflows/deploy-preview.yml`.

## Repo-local skills and prompts

Use repo skills in `.agents/skills/` when a task matches their description:

- `studiobook-codebase` for orientation and source maps.
- `studiobook-feature-workflow` for product/API/UI changes.
- `studiobook-data-and-migrations` for schema, repository, seed, or Supabase work.
- `studiobook-notifications` for email/outbox work.
- `studiobook-deploy-preview` for OpenNext, Wrangler, SHIP, and preview deploys.
- `posthog-nextjs` for PostHog analytics, flags, and experiments.
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
