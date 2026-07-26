import * as Sentry from "@sentry/nextjs";

// Next.js instrumentation entrypoint (App Router): initializes Sentry so
// errors reported via lib/monitoring.ts's captureException actually reach
// Sentry in production. No-ops when no DSN is configured, so hermetic tests,
// local dev, and `pnpm build` are unaffected.
export async function register() {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    tracesSampleRate: 0,
  });
}
