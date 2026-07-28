import * as Sentry from "@sentry/nextjs";

// Next.js instrumentation hook: initialise Sentry so captured exceptions ship
// in production. Without a DSN (hermetic tests, local dev) this is a no-op.
export async function register(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }
  Sentry.init({ dsn });
}
