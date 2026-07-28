import * as Sentry from "@sentry/nextjs";

// Server-side Sentry init. The DSN comes from the environment and is never
// committed; when SENTRY_DSN is unset (local dev, tests, CI), init is a
// no-op so error monitoring stays hermetic and captureException is inert.
//
// Note: this app deploys to Cloudflare Workers via OpenNext rather than the
// standard Next.js Node server, so the runtime may differ from the default
// Sentry Next.js setup; SENTRY_DSN must be configured for the deployed
// worker for reports to be delivered.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0,
});
