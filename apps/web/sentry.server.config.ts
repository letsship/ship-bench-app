import * as Sentry from "@sentry/nextjs";

// Loaded by instrumentation.ts for the Node.js runtime (our only runtime — see
// apps/web/wrangler.jsonc's nodejs_compat flag). Reports genuinely unexpected
// server errors; see lib/http.ts's handle() for what actually gets captured.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT,
  tracesSampleRate: 0,
});
