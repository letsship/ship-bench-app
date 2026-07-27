import { captureException } from "@sentry/nextjs";

// Thin seam wrapping Sentry's captureException. Never throws; a monitoring
// failure must never break a response. console.error on failure so the issue
// is visible but doesn't propagate.
export function reportException(error: unknown): void {
  try {
    captureException(error);
  } catch (e) {
    console.error("Failed to report exception to Sentry", e);
  }
}
