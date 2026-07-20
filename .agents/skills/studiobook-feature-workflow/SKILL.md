---
name: studiobook-feature-workflow
description: Implement or modify Studiobook product behavior across Next.js App Router pages, API routes, services, domain logic, validation, and tests. Use for feature work, UI/API changes, bug fixes that change behavior, or adding workflows in apps/web.
---

# Studiobook Feature Workflow

Use `studiobook-codebase` first if you are not already oriented.

## Preferred flow

1. Locate the user-facing entrypoint in `apps/web/app/`.
2. Trace server behavior into `apps/web/lib/services/`.
3. Put reusable business rules in `apps/web/lib/domain/`.
4. Add or update request schemas in `apps/web/lib/validation.ts`.
5. Add repository methods only when a service cannot express the behavior with existing ones.
6. Cover changed behavior with Vitest near the owning layer.

## API route pattern

- Export `dynamic = "force-dynamic"` for routes that read mutable app data.
- Wrap route bodies in `handle(async () => ...)`.
- Validate request JSON with the relevant Zod schema before calling services.
- Use `requireSession()` for mutating routes.
- Return `ok()` or `created()` for JSON responses; use a raw `Response` only for non-JSON bodies.
- Throw `HttpError` from services for expected application failures.

## Page and form pattern

- Server pages resolve data through `resolveStudio()`.
- Reuse local components from `apps/web/app/(app)/_components/`.
- Client form components call APIs through `sendJson()` and surface returned error messages.
- Match existing Tailwind utility and `sb-*` class conventions in `global.css`.

## Test pattern

- Pure rules: add tests in `apps/web/lib/domain/*.test.ts`.
- Service behavior: use `createInMemoryRepositories()` and fake notification providers.
- API routing behavior: extend `apps/web/lib/services/routes.test.ts` when the route contract matters.
- Avoid real Supabase, Resend, network, or Docker in tests.
