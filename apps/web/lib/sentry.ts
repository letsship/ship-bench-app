import * as Sentry from "@sentry/nextjs";

// Sentry.init is expensive and only meaningful once per process, so we defer
// it until the first unexpected error instead of running it on every import
// (e.g. in tests, or in fake-backends mode where no DSN is configured).
//
// Read directly from process.env (like RESEND_API_KEY in notifications/provider.ts)
// rather than serverEnv(), which requires the full server schema (including
// Supabase secrets) to be set — we don't want error reporting itself to throw
// when unrelated env vars are missing, e.g. in fake-backends mode.

let initialized = false;

function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn });
}

export function reportUnexpectedError(error: unknown): void {
  ensureInitialized();
  Sentry.captureException(error);
}
