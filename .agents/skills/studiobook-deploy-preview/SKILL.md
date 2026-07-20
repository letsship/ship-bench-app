---
name: studiobook-deploy-preview
description: Diagnose or modify Studiobook Cloudflare/OpenNext preview deployment, SHIP manifest, Wrangler configs, GitHub Actions preview workflow, Worker secrets, or schema-pool isolation. Use for deploy failures, preview environment changes, or Worker runtime issues.
---

# Studiobook Deploy Preview

Use `workers-best-practices` and `wrangler` for Cloudflare-specific API or
config uncertainty.

## Files

- `ship.yml`: SHIP preview manifest and skip-deploy rules.
- `.github/workflows/deploy-preview.yml`: workflow_dispatch deploy/delete implementation.
- `apps/web/wrangler.preview.jsonc`: route-less preview Worker config.
- `apps/web/wrangler.jsonc`: production Worker config.
- `apps/web/open-next.config.ts`: OpenNext config.
- `apps/web/package.json`: `build:cf` and `preview:cf` scripts.
- `packages/db/scripts/reseed-schema.sh`: preview schema reseed helper.

## Model

- OpenNext builds `apps/web` into `.open-next/`; do not commit that output.
- `NEXT_PUBLIC_*` values are build-time inputs and can be inlined into client bundles.
- `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, and `SUPABASE_SCHEMA` are runtime Worker secrets.
- Preview workers deploy to `*.workers.dev`; the orchestrator supplies the Worker name.
- Preview data is isolated by deterministic schema pool selection, not by separate Supabase projects.

## Troubleshooting order

1. Identify whether the failure is install, build, deploy, secret, schema reseed, or runtime.
2. Inspect workflow logs and the exact step before changing source.
3. Validate config paths relative to repo root versus `apps/web`.
4. Prefer workflow/config fixes for deploy issues; change app code only when logs point to app behavior.
5. Keep generated `.open-next/`, `.next/`, and `.turbo/` out of commits.
