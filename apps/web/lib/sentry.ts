import * as Sentry from "@sentry/nextjs";
import { sentryEnv } from "./env";

let initialized = false;

export async function reportUnexpectedError(error: unknown): Promise<void> {
  const { SENTRY_DSN } = sentryEnv();
  if (!SENTRY_DSN) return;

  if (!initialized) {
    Sentry.init({ dsn: SENTRY_DSN });
    initialized = true;
  }

  Sentry.captureException(error);
  await Sentry.flush(2000);
}
