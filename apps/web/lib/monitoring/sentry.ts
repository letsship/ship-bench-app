import * as Sentry from "@sentry/nextjs";

// Reports genuinely unexpected server errors to Sentry. A no-op when
// SENTRY_DSN isn't configured (local dev, fake-backends, tests), so nothing
// throws or attempts a network call without a destination. Kept separate from
// `lib/http.ts` so it's trivial to mock in tests and Sentry stays an
// implementation detail of error reporting rather than of request handling.

let initialized = false;

function ensureInitialized(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  if (!initialized) {
    Sentry.init({ dsn });
    initialized = true;
  }
  return true;
}

export function reportUnexpectedError(error: unknown): void {
  if (!ensureInitialized()) return;
  Sentry.captureException(error);
}
