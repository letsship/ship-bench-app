# Feature implementation prompt

Use `$studiobook-feature-workflow` for this task.

Goal:

- Implement the requested feature with the smallest source change that fits the
  existing architecture.

Discovery:

- Read `AGENTS.md`.
- Inspect the relevant App Router page or API route.
- Trace behavior through `apps/web/lib/services/`, `apps/web/lib/domain/`,
  `apps/web/lib/db/repos/types.ts`, and existing tests before editing.

Implementation rules:

- Keep Supabase access behind repositories.
- Keep request validation in `apps/web/lib/validation.ts`.
- Keep API errors behind `handle()` / `HttpError`.
- Keep pure business rules in `apps/web/lib/domain/` when they are reusable or
  testable without framework state.

Acceptance:

- Add or update focused Vitest coverage for changed service/domain behavior.
- Run the narrow relevant test first, then the broadest practical check for the
  change.
- Report any checks that could not be run.
