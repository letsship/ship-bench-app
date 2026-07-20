# Bug fix prompt

Use `$studiobook-codebase` and, when behavior changes,
`$studiobook-feature-workflow`.

Goal:

- Reproduce or localize the bug, fix the root cause, and add a regression test
  where practical.

Discovery:

- Read `AGENTS.md`.
- Search for the failing behavior, related tests, and the service/domain code
  that owns the rule.
- Check whether the issue appears in both fake and Supabase repository paths if
  persistence behavior is involved.

Implementation rules:

- Prefer a targeted fix over broad refactors.
- Do not mask unexpected errors with silent fallbacks.
- Preserve the shared API error envelope and existing UI patterns.

Acceptance:

- Run the regression test or nearest focused suite.
- Run `pnpm typecheck` or explain why it was not run.
