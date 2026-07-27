import { captureException } from "@sentry/nextjs";

// The error-reporting seam. Only genuinely unexpected failures come through
// here: our handled outcomes (Zod validation errors, deliberate HttpErrors such
// as 404 / 409 / 402) are normal responses and must never be reported, or
// Sentry stops being signal. Keeping the SDK behind this thin wrapper matches
// the repo's other seams (notification provider, db repos) and gives tests a
// clean mock boundary.

export function reportUnexpectedError(error: unknown): void {
  try {
    // A no-op when Sentry has no DSN configured (hermetic tests, local dev).
    captureException(error);
  } catch (reportingError) {
    // Reporting must never mask the response we are already returning.
    console.error("Failed to report error to Sentry", reportingError);
  }
}
