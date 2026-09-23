import * as Sentry from "@sentry/nextjs";

export const reportUnexpectedError = (error: unknown): void => {
  try {
    Sentry.captureException(error);
  } catch (reportingError) {
    console.error("Failed to report unexpected error to Sentry", reportingError);
  }
};
