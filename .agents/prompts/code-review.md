# Code review prompt

Use `$studiobook-codebase` and any task-specific skill that matches the diff.

Review stance:

- Lead with findings, ordered by severity.
- Focus on bugs, regressions, architectural seam violations, missing tests, and
  deployment or data risks.
- Include file and line references for every finding.

Checklist:

- No direct `@supabase/supabase-js` outside the repository implementation or
  Supabase client factories.
- No direct Cloudflare Email usage outside `apps/web/lib/notifications/cloudflare-email-provider.ts`.
- Route handlers validate input with Zod and use `handle()`.
- Fake repositories and Supabase repositories stay behaviorally aligned.
- Tests cover changed domain/service behavior.
- Generated output is not included in the diff.
