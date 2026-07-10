import * as Sentry from "@sentry/nextjs";

// Loaded by instrumentation.ts for the Node.js runtime. We deploy to Cloudflare
// Workers via OpenNext; Sentry's own Next.js-on-Cloudflare guide confirms the
// standard @sentry/nextjs setup works there as-is, provided wrangler.jsonc has
// nodejs_compat and a compatibility_date of 2025-08-16+ (for node:http/https) —
// see https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/nextjs/
// Reports genuinely unexpected server errors; see lib/http.ts's handle() for
// what actually gets captured.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT,
  tracesSampleRate: 0,
});
