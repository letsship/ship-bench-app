# Agent guide — Studiobook

Full project overview, stack, and architecture are in `README.md`. This is the quick reference for coding agents working in this repo.

## Commands (from the repo root)

- Install: `pnpm install`
- Full check suite (what CI gates on): `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- Tests are hermetic: `pnpm test` runs against in-memory repository + email fakes (no Supabase, Resend, or network needed).
- Local dev against fakes: `pnpm --filter @studiobook/web dev:fake`

## Architecture seams

- Database access goes through the repositories in `apps/web/lib/db/repos/`; route handlers and domain logic never import `@supabase/supabase-js` directly.
- Email goes through the notification adapter + outbox in `apps/web/lib/notifications/`; domain code never calls the Resend SDK directly.
- Follow the repo's existing patterns and conventions when adding code.

## Vendor docs (offline reference)

Doc-only copies of official vendor agent docs are in `docs/vendor/` (PostHog analytics / flags / experiments; Cloudflare D1 + Email Service). Individual tickets also link the live vendor docs for the task at hand. Prefer the vendored copy for offline, deterministic work.

## Conventions

TypeScript strict. ESLint + Prettier (`pnpm format`). Match the surrounding code.
