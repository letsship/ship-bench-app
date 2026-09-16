import * as Sentry from "@sentry/nextjs";
import { sentryEnv } from "./env";

let initialized = false;

const initializeSentry = (): boolean => {
  const { SENTRY_DSN: dsn } = sentryEnv();
  if (!dsn) return false;

  if (!initialized) {
    Sentry.init({ dsn });
    initialized = true;
  }

  return true;
};

export const reportUnexpectedError = async (error: unknown): Promise<void> => {
  if (!initializeSentry()) return;

  Sentry.captureException(error);
  await Sentry.flush(2000);
};
