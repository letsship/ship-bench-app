---
name: posthog-nextjs
description: Add, review, or modify PostHog analytics, feature flags, or experiments in this Next.js App Router repo. Use when working with PostHog SDK setup, event capture, identity, server/client flag evaluation, experiment code, or vendored PostHog docs.
---

# PostHog Next.js

Prefer the vendored offline docs in `docs/vendor/` for deterministic work.

## Read the matching reference

- Analytics SDK setup or event capture: `docs/vendor/posthog-nextjs.md`.
- Feature flags: `docs/vendor/posthog-feature-flags.md`.
- Experiments: `docs/vendor/posthog-experiments.md`.

## Repo integration rules

- Add env vars through `apps/web/lib/env.ts` and `.env.example` when needed.
- Keep server-only SDK usage out of client components.
- Keep client initialization in the documented Next.js App Router entrypoint.
- Avoid adding analytics calls to pure domain modules.
- Include tests or a clear manual verification path for event/flag-dependent UI.

## Cautions

- PostHog docs can change. If the task requires latest SDK behavior, check live
  official PostHog docs before implementation.
- Do not hardcode project tokens or personal API keys.
