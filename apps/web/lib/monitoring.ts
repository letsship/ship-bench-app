import * as Sentry from "@sentry/nextjs";

// Thin seam over the Sentry SDK so callers (and tests) never import it
// directly. captureException is a safe no-op when Sentry.init has not run
// (e.g. no DSN configured), so this is always safe to call.

export function reportUnexpectedError(error: unknown): void {
  Sentry.captureException(error);
}
