import * as Sentry from "@sentry/nextjs";

// Thin seam around the Sentry SDK so http.ts stays framework-light and the
// call is trivially mockable in tests. Never throws: a monitoring hiccup
// must not break the primary response.
export function captureServerError(error: unknown): void {
  try {
    Sentry.captureException(error);
  } catch (captureError) {
    console.error("Failed to report error to Sentry", captureError);
  }
}
