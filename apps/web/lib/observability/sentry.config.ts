import * as Sentry from "@sentry/nextjs";

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn });
}