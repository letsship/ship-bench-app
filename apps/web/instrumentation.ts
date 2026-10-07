import * as Sentry from "@sentry/nextjs";
import { sentryDsn } from "./lib/env";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" && process.env.NEXT_RUNTIME !== "edge") {
    return;
  }

  const dsn = sentryDsn();
  if (dsn) {
    Sentry.init({ dsn, tracesSampleRate: 0 });
  }
}

export const onRequestError = Sentry.captureRequestError;
