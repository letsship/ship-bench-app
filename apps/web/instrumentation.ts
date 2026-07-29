// Next.js instrumentation hook: runs once at server startup, per runtime.
// Loads the runtime-specific Sentry config; each config is a no-op unless a
// DSN is set, so tests, local dev, and unconfigured previews stay silent.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
