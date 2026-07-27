import * as Sentry from "@sentry/nextjs";

export function reportUnexpectedError(error: unknown): void {
  try {
    Sentry.captureException(error);
  } catch (e) {
    console.error("Failed to report error to Sentry", e);
  }
}
