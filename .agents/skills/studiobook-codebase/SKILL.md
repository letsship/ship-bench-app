---
name: studiobook-codebase
description: Orient and work efficiently in the Studiobook repository. Use when Codex needs repo structure, architecture seams, commands, generated-file warnings, testing strategy, or source ownership before making code changes, reviews, or plans.
---

# Studiobook Codebase

Read `AGENTS.md` first, then use this skill as a compact source map.

## Source map

- `apps/web/app/`: Next.js App Router pages, layouts, route handlers, and local UI components.
- `apps/web/lib/domain/`: pure business rules. Keep framework, database, request, and email code out.
- `apps/web/lib/services/`: repository-backed use cases shared by pages and routes.
- `apps/web/lib/db/types.ts`: camelCase app entity types.
- `apps/web/lib/db/repos/`: repository seam, Supabase implementation, in-memory fake implementation, mapping.
- `apps/web/lib/notifications/`: message builders, outbox, provider contract, fake provider, Resend provider.
- `apps/web/lib/http.ts`: shared API response helpers and JSON error envelope.
- `apps/web/lib/validation.ts`: Zod schemas for API input boundaries.
- `packages/db/migrations/`: raw SQL migrations.
- `docs/vendor/`: offline vendor docs for deterministic agent work.

## Commands

- Full CI gate: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Fast behavior check: `pnpm test`.
- Fake local dev: `pnpm --filter @studiobook/web dev:fake`.
- Browser smoke: `pnpm --filter @studiobook/web e2e`.

## Guardrails

- Do not edit generated outputs: `.next`, `.open-next`, `.turbo`, `dist`, `next-env.d.ts`, `*.tsbuildinfo`.
- Do not import Supabase directly outside repository implementations and Supabase client factories.
- Do not import Resend directly outside `apps/web/lib/notifications/resend-provider.ts`.
- Keep fake-backend behavior aligned with production repository behavior.
- Prefer focused tests near changed behavior over broad snapshot-style assertions.
