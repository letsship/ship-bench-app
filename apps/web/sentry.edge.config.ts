import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

// Edge runtime (Cloudflare/opennext runs edge-like). Mirrors the server
// config: no DSN -> no init, so captureException stays a no-op.
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}
