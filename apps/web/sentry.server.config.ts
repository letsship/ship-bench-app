import * as Sentry from "@sentry/nextjs";

// Error monitoring only (no perf tracing). No-ops cleanly when SENTRY_DSN is
// unset, so dev/test/fake-backends stay hermetic with no Sentry account.
// Reads process.env directly (not serverEnv()): this module loads on every
// server start via instrumentation.ts, and serverEnv() eagerly validates the
// whole server schema (including required Supabase secrets), which would
// break fake-backends/dev/test runs that don't set them.
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
}
