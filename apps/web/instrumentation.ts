import * as Sentry from "@sentry/nextjs";

// Next.js instrumentation hook (see
// https://docs.sentry.io/platforms/javascript/guides/nextjs/): initializes
// Sentry once at server boot for the Node.js runtime so the SDK is warm
// before request handlers run. A no-op when SENTRY_DSN isn't configured
// (local dev, fake-backends, tests, and the edge runtime). The actual capture
// point for API route errors is `lib/monitoring/sentry.ts`'s
// reportUnexpectedError, which lazily initializes Sentry itself if this hook
// didn't run first.
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn });
}
