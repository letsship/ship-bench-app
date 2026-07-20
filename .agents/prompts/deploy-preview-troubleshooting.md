# Deploy and preview troubleshooting prompt

Use `$studiobook-deploy-preview`, `$workers-best-practices`, and `$wrangler` for
this task.

Goal:

- Diagnose preview deploy, Worker runtime, OpenNext, or SHIP orchestration
  issues without changing unrelated app behavior.

Discovery:

- Read `AGENTS.md`.
- Inspect `ship.yml`, `.github/workflows/deploy-preview.yml`,
  `apps/web/wrangler.preview.jsonc`, `apps/web/wrangler.jsonc`, and
  `apps/web/package.json`.

Checks:

- Confirm build-time `NEXT_PUBLIC_*` variables versus runtime Worker secrets.
- Confirm preview schema isolation and reseed steps.
- Confirm Wrangler config path and worker name handling.
- Do not commit generated `.open-next/` output.

Acceptance:

- Prefer config/workflow fixes over app changes unless logs prove an app bug.
- Run validation commands that do not require live Cloudflare access first.
