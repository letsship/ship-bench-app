import * as Sentry from "@sentry/nextjs";

export const register = (): void => {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    enabled: Boolean(process.env.SENTRY_DSN),
  });
};
