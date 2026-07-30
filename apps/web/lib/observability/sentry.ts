import * as Sentry from "@sentry/nextjs";

// Thin observability seam: the only module route code imports Sentry from.
// Centralising it here keeps the SDK swappable and lets tests vi.mock this
// module instead of the real package.

// Report a genuine, unexpected failure to Sentry. Handled outcomes (ZodError,
// HttpError) must never reach this — see handle() in lib/http.ts.
export function captureException(error: unknown): void {
  Sentry.captureException(error);
}

// Initialise Sentry only when a DSN is configured. With no DSN (hermetic tests,
// dev:fake) this is a no-op, so nothing depends on the network or a project.
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    // Don't block the response on event delivery: report and move on.
    tracesSampleRate: 1.0,
  });
}
