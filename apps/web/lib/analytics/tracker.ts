import { createFakeTracker } from "./fake-tracker";
import { createPosthogTracker } from "./posthog-tracker";
import type { AnalyticsTracker } from "./types";

// The app's analytics tracker. Production uses PostHog (a real API key is
// required — a missing key is surfaced as an error, never silently degraded).
// The local fake-backends mode uses the in-memory recorder so the app runs with
// no vendor account.
export function createAnalyticsTracker(): AnalyticsTracker {
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeTracker();
  }
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    throw new Error(
      "POSTHOG_API_KEY is not set. Set it for real analytics capture, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createPosthogTracker({
    apiKey,
    host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
  });
}
