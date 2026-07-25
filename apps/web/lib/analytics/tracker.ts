import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { AnalyticsTracker } from "./types";

// The app's analytics tracker. Production uses PostHog (a real API token is
// required — a missing token is surfaced as an error, never silently degraded).
// The local fake-backends mode uses the in-memory recorder so the app runs with
// no vendor account. Tests can inject a specific tracker via __setTestTracker.

let testTracker: AnalyticsTracker | null = null;

export function __setTestTracker(tracker: AnalyticsTracker | null): void {
  testTracker = tracker;
}

export function createTracker(): AnalyticsTracker {
  if (testTracker) return testTracker;
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeTracker();
  }
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!token) {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set. Set it for real analytics, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  if (!host) {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_HOST is not set. Set it for real analytics, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createPostHogTracker({ token, host });
}
