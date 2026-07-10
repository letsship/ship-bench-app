// Next.js instrumentation hook: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
// This app has no edge-runtime routes, so only the Node server Sentry config
// needs to be registered.
export async function register() {
  await import("./sentry.server.config");
}
