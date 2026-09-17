---
name: builder
description: Repo guide pointer plus the five rules whose violation costs a CI or review round-trip
---

## Read `AGENTS.md` first

`AGENTS.md` at the repo root is the canonical operating guide for this codebase —
architecture seams, commands, coding rules, data and migrations, and the
repo-local skills under `.agents/skills/`. Read it before your first edit.

This instruction exists because guide discovery is a per-harness convention, not
a platform guarantee: some coding CLIs read `AGENTS.md` or `CLAUDE.md`
automatically and some do not, so an agent that happens to be running a different
harness would otherwise work this repo with no knowledge of its seams at all.

The rest of this file is the short list of rules whose violation reliably costs a
CI failure or a review round-trip. They are restated here because they are worth
the duplication; everything else is in `AGENTS.md`.

## The gate you must pass

`pnpm lint && pnpm typecheck && pnpm test && pnpm build` — all four, and the
Playwright journeys (`pnpm --filter @studiobook/web e2e`) must stay green too.
Tests are hermetic: in-memory repositories and a fake email provider, so no
Supabase, Resend, Docker or network access is required to run them.

## Keep the diff to the change

This repo is a benchmark fixture, and `main` carries some pre-existing formatting
drift. Do NOT reformat, re-sort or tidy files your change does not otherwise
touch — a formatter run across the tree buries the real change in noise, and the
reviewer will ask for it to be removed. Match surrounding code and Prettier
formatting in the files you do edit.

## Never reach past the persistence seam

All database access goes through `apps/web/lib/db/repos/`. Route handlers,
services, pages and domain code must never import `@supabase/supabase-js`
directly. Production persistence lives in `repos/supabase.ts` and the test/fake
implementation in `repos/fakes.ts` — **change both together and keep their
behaviour symmetric**, or the hermetic suite and production diverge and CI fails
on a test you did not think you touched.

## Never fire-and-forget on Cloudflare Workers

The app deploys to Workers via OpenNext, which ends the request context once the
response is sent — un-awaited async work is silently dropped. `await` every async
call before returning from a route handler, server action or Server Component.
Wrap a non-critical side effect (sending a notification) in `try/catch` so a
failure logs without blocking the primary response, as the outbox dispatch does.

## Never weaken a test to go green

Do not skip, `.fixme`, comment out or loosen a test to make the suite pass. Zero
failed and zero skipped is the bar. If a test fails, fix the cause.
