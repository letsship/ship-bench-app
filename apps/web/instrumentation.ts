import * as Sentry from "@sentry/nextjs";
import { sentryEnv } from "@/lib/env";

export const register = async (): Promise<void> => {
  const { SENTRY_DSN: dsn } = sentryEnv();
  if (!dsn) return;

  Sentry.init({ dsn, tracesSampleRate: 0 });
};

export const onRequestError = Sentry.captureRequestError;
