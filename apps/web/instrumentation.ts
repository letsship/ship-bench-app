import * as Sentry from "@sentry/nextjs";

// Initialize Sentry for the server/edge runtime. Only initializes if SENTRY_DSN
// is set, so local dev, hermetic tests, and CI builds without a DSN are unaffected
// (Sentry becomes a no-op and captureException does nothing).
export async function register(): Promise<void> {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0,
    environment: process.env.NODE_ENV || "production",
  });
}
