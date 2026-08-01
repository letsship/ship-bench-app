import * as Sentry from "@sentry/nextjs";

export async function register(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    Sentry.init({ dsn });
  }
}
