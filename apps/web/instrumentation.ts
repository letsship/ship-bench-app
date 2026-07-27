import * as Sentry from "@sentry/nextjs";

// Next.js instrumentation hook: runs once per server runtime at startup. It is
// where the Sentry SDK is initialised so that reportUnexpectedError() in
// lib/observability/sentry.ts has a configured client to send to.
//
// Init is env-gated: with no DSN (hermetic tests, fake-backends dev, DSN-less
// builds) register() does nothing and captureException stays an inert no-op.

export function register(): void {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
}
