// Next.js instrumentation hook: initialise server-side Sentry once per server
// start. Only the nodejs runtime is wired up; without a SENTRY_DSN the import
// is a no-op (see sentry.server.config.ts).

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}
