import * as Sentry from "@sentry/nextjs";

// Server-side Sentry initialisation, guarded on SENTRY_DSN so DSN-less
// environments (CI builds, hermetic tests, fake-backends dev) leave the SDK
// uninitialised — captureException is then a no-op (see lib/monitoring.ts).

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({ dsn });
}
