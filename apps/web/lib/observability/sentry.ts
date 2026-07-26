import * as Sentry from "@sentry/nextjs";

// Single import point for error reporting. Route code and http.ts call
// captureException() through here (never `@sentry/nextjs` directly) so the
// reporting call is trivially mockable in unit tests without network access.

export function captureException(error: unknown): void {
  Sentry.captureException(error);
}

// Guarded like lib/env.ts's env access: Sentry.init only runs when a DSN is
// configured, so hermetic tests, fake-backends dev, and the build stay inert.
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn });
}
