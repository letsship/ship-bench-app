import * as Sentry from "@sentry/nextjs";

// Observability seam mirroring the notifications provider pattern: handle()
// reports through this wrapper instead of importing the Sentry SDK directly,
// so the hermetic test suite can mock reporting with no DSN and no Sentry
// initialization. captureException is a safe no-op when the SDK has not been
// initialized.
export function reportUnexpectedError(error: unknown): void {
  Sentry.captureException(error);
}
