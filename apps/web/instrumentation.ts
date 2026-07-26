import { initSentry } from "@/lib/observability/sentry";

// Next.js instrumentation hook: runs once when the server/edge runtime boots.
// initSentry() is a no-op without SENTRY_DSN, so this is inert for hermetic
// tests, fake-backends dev, and the build.
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    initSentry();
  }
}
