# Database change prompt

Use `$studiobook-data-and-migrations` for this task.

Goal:

- Make the requested schema/data change while preserving repository abstraction
  and fake-backend parity.

Discovery:

- Read `AGENTS.md`.
- Inspect `packages/db/migrations/`, `apps/web/lib/db/types.ts`,
  `apps/web/lib/db/repos/types.ts`, `fakes.ts`, `supabase.ts`, and relevant
  service tests.

Implementation rules:

- Add a new numbered raw SQL migration; do not rewrite existing migrations
  unless the user explicitly requests history edits.
- Update TypeScript entity types and both repository implementations.
- Keep snake_case/camelCase mapping centralized.
- Update seed data and regenerate `supabase/seed.sql` when fixture data changes.

Acceptance:

- Add or update repository/service tests for new data behavior.
- Run focused tests, then `pnpm typecheck` when practical.
