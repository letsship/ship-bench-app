// Next.js instrumentation entrypoint. Registers Sentry for the server runtime
// per https://docs.sentry.io/platforms/javascript/guides/nextjs/.
// Guarded by NEXT_RUNTIME so nothing initializes at import time in runtimes
// where it does not apply; with no SENTRY_DSN set, init is a no-op.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

export { captureRequestError } from "@sentry/nextjs";
