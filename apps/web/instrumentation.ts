import * as Sentry from "@sentry/nextjs";

// Next.js calls register() once on server startup. Sentry stays fully inert
// without a configured DSN, so local/dev/test/CI runs need no Sentry project.
export function register(): void {
  if (!process.env.SENTRY_DSN) {
    return;
  }
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}
