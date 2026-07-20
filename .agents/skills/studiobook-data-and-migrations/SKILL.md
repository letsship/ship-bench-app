---
name: studiobook-data-and-migrations
description: Work on Studiobook database schema, migrations, seed data, repository interfaces, Supabase persistence, fake repositories, or data model changes. Use when adding tables/columns, changing entity types, updating seed fixtures, or debugging persistence parity.
---

# Studiobook Data And Migrations

Use this skill for any persistence-facing change.

## Required seams

- App code depends on `Repositories` from `apps/web/lib/db/repos/types.ts`.
- Production data access lives in `apps/web/lib/db/repos/supabase.ts`.
- Tests and fake local dev use `apps/web/lib/db/repos/fakes.ts`.
- Entity types are camelCase in `apps/web/lib/db/types.ts`.
- Snake_case conversion is centralized in `apps/web/lib/db/repos/mapping.ts`.

## Change workflow

1. Add a new sequential SQL migration in `packages/db/migrations/`.
2. Update `apps/web/lib/db/types.ts`.
3. Update `Repositories` only if services need a new data operation.
4. Implement the operation in both `supabase.ts` and `fakes.ts`.
5. Update services and tests.
6. If fixture data changes, update `apps/web/lib/db/seed-data.ts` and regenerate `supabase/seed.sql`.

## Rules

- Do not rewrite existing migrations unless explicitly asked.
- Preserve RLS posture unless the task explicitly changes auth/security.
- Keep ids and timestamps app-side when matching existing insert patterns.
- Sort fake repository list methods the same way as Supabase queries.
- Ensure empty-list behavior matches production, especially for `.in()` style queries.

## Validation

- Run focused repository/service tests first.
- Run `pnpm --filter @studiobook/web db:seed-sql` after seed changes.
- Run `pnpm typecheck` after type or repository interface changes.
