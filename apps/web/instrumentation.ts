import { initSentry } from "@/lib/observability/sentry";

// Next.js instrumentation entrypoint (see Sentry for Next.js docs). Runs once
// when the server runtime starts up. initSentry() is env-gated — without a
// SENTRY_DSN this is a no-op, so hermetic tests and dev:fake are unaffected.
//
// Cloudflare Workers / OpenNext caveat: the request context ends as soon as
// the response is sent, so captureException is invoked synchronously inside
// handle() (before returning) rather than fire-and-forget. Nothing here should
// kick off un-awaited async work either.
export async function register(): Promise<void> {
  if (typeof window !== "undefined") return;
  initSentry();
}
