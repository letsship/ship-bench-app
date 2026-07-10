import { serverEnv } from "@/lib/env";
import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { AnalyticsTracker } from "./types";

// The app's analytics tracker. Production uses PostHog (a real API key is
// required — a missing key is surfaced as an error, never silently degraded).
// The local fake-backends mode uses the in-memory recorder so the app runs with
// no vendor account.
export function createAnalyticsTracker(): AnalyticsTracker {
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeTracker();
  }
  const { POSTHOG_PROJECT_API_KEY: apiKey, POSTHOG_HOST: host } = serverEnv();
  if (!apiKey || !host) {
    throw new Error(
      "POSTHOG_PROJECT_API_KEY / POSTHOG_HOST are not set. Set them for real analytics capture, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createPostHogTracker({ apiKey, host });
}
