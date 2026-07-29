import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

// No DSN (hermetic tests, local dev, unconfigured previews) -> skip init so
// captureException stays a no-op instead of pointing at nothing.
if (dsn) {
  Sentry.init({
    dsn,
    // Error monitoring is what we are here for; keep tracing conservative.
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}
