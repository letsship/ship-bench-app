import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN });
  }
}