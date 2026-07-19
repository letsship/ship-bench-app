export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
    const { default: Sentry } = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
    });
  }
}
