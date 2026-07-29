// Next.js App Router instrumentation hook. Runs `Sentry.init` once at server
// startup so that `captureException` calls from `lib/http.ts` are actually
// delivered in production. The DSN is supplied via the `SENTRY_DSN` env var in
// deployed environments (Cloudflare Worker / preview / production). When the
// DSN is unset — as it is in CI (`pnpm test`, `pnpm build`) and fake-dev mode —
// we skip init entirely; `captureException` is then a safe no-op, keeping the
// test suite and build hermetic and network-free.
import * as Sentry from "@sentry/nextjs";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    // Error monitoring only — no performance traces for now.
    tracesSampleRate: 0,
  });
}
