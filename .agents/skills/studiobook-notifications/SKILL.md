---
name: studiobook-notifications
description: Work on Studiobook email, notification messages, opt-out logic, outbox dispatch, fake provider behavior, or Cloudflare Email integration. Use when adding notification kinds, changing delivery rules, debugging email sends, or replacing the provider.
---

# Studiobook Notifications

Email is behind a provider-agnostic adapter and an outbox.

## Files

- `apps/web/lib/notifications/types.ts`: provider and message contracts.
- `apps/web/lib/notifications/messages.ts`: message builders.
- `apps/web/lib/notifications/outbox.ts`: enqueue, opt-out checks, dispatch, retries.
- `apps/web/lib/notifications/provider.ts`: fake-vs-real provider selection.
- `apps/web/lib/notifications/fake-provider.ts`: hermetic tests and fake dev.
- `apps/web/lib/notifications/cloudflare-email-provider.ts`: the only direct Cloudflare Email adapter.

## Rules

- Do not call Cloudflare Email from services, routes, pages, or domain modules.
- Add new notification kinds to `NotificationKind`, message builders, and the setting map in `outbox.ts`.
- Preserve member opt-out precedence over studio-level settings.
- Failed sends keep `sentAt: null` so they are retryable.
- Fake-backends mode must not require `CF_EMAIL_API_TOKEN`.

## Testing

- Use `createFakeProvider()` for service tests.
- Extend `outbox.test.ts` for opt-out, skip, retry, and dispatch behavior.
- Extend `cloudflare-email-provider.test.ts` only for Cloudflare Email adapter mapping or error behavior.

## Vendor docs

- The concrete email vendor is referenced only in the provider adapter
  (`cloudflare-email-provider.ts` today).
- If you swap the provider adapter to a different vendor, load that vendor's
  skill for its API details and follow the task's stated contract.
