import * as Sentry from "@sentry/nextjs";

// Guarded init: no-op when SENTRY_DSN is unset, so hermetic tests and
// fake-backends dev never need Sentry configured.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0,
  });
}
