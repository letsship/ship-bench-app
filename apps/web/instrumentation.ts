import * as Sentry from "@sentry/nextjs";

export function register() {
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    Sentry.init({ dsn });
  }
}
