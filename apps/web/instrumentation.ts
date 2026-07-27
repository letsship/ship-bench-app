export async function register() {
  if (!process.env.SENTRY_DSN) {
    return;
  }
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({ dsn: process.env.SENTRY_DSN });
  }
}
