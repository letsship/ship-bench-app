---
name: studiobook-data-and-migrations
description: Work on Studiobook database schema, migrations, seed data, repository interfaces, D1 persistence, fake repositories, or data model changes. Use when adding tables/columns, changing entity types, updating seed fixtures, or debugging persistence parity.
---

# Studiobook Data And Migrations

Use this skill for any persistence-facing change.

## Required seams

- App code depends on `Repositories` from `apps/web/lib/db/repos/types.ts`.
- Production data access lives in `apps/web/lib/db/repos/d1.ts` (Drizzle ORM
  over the Cloudflare D1 `DB` binding; tables in `apps/web/lib/db/repos/schema.ts`).
- Tests and fake local dev use `apps/web/lib/db/repos/fakes.ts`.
- Entity types are camelCase in `apps/web/lib/db/types.ts`.
- Camel↔snake column mapping lives in the Drizzle table definitions in
  `apps/web/lib/db/repos/schema.ts`.

## Change workflow

1. Add a new sequential SQL migration in `apps/web/migrations/`.
2. Update `apps/web/lib/db/types.ts`.
3. Update `Repositories` only if services need a new data operation.
4. Implement the operation in both `d1.ts` and `fakes.ts`.
5. Update services and tests.
6. If fixture data changes, update `apps/web/lib/db/seed-data.ts` and regenerate `supabase/seed.sql`.

## Rules

- Do not rewrite existing migrations unless explicitly asked.
- Preserve FK/constraint posture unless the task explicitly changes auth/security.
- Keep ids and timestamps app-side when matching existing insert patterns.
- Sort fake repository list methods the same way as D1 queries.
- Ensure empty-list behavior matches production, especially for in-array style queries.

## Validation

- Run focused repository/service tests first.
- Run `pnpm --filter @studiobook/web db:seed-sql` after seed changes.
- Run `pnpm typecheck` after type or repository interface changes.
