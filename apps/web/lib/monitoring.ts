import * as Sentry from "@sentry/nextjs";

// Thin seam over the Sentry SDK so callers (and tests) never touch the vendor
// SDK directly — mirrors the notifications provider seam. Sentry itself is a
// safe no-op when initialized without a DSN, so this never needs its own guard.
export function captureException(error: unknown): void {
  Sentry.captureException(error);
}
