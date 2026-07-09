import * as Sentry from "@sentry/nextjs";

// Lazily initializes Sentry on first use so tests/local dev without a
// SENTRY_DSN never need to configure it: Sentry.init() with an undefined dsn
// disables the client, making it a no-op.

let initialized = false;

function ensureInitialized(): void {
  if (initialized) return;
  Sentry.init({ dsn: process.env.SENTRY_DSN });
  initialized = true;
}

export function captureUnexpectedError(error: unknown): void {
  ensureInitialized();
  Sentry.captureException(error);
}
