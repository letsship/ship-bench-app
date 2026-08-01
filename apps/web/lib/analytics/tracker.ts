import { createFakeTracker } from "./fake-tracker";
import type { AnalyticsTracker } from "./types";

// Resolve the request's analytics tracker. Production uses PostHog (a real
// project token is required — a missing token is surfaced as an error, never
// silently degraded); `USE_FAKE_BACKENDS=1` uses the in-memory recorder; tests
// inject their own via __setTestTracker. This mirrors __setTestRepositories on
// the repository seam and is the single place the real client is constructed.

let testTracker: AnalyticsTracker | null = null;

export function __setTestTracker(tracker: AnalyticsTracker | null): void {
  testTracker = tracker;
}

export async function resolveTracker(): Promise<AnalyticsTracker> {
  if (testTracker) return testTracker;
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeTracker();
  }
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!apiKey) {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set. Set it for PostHog analytics, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  const { createPostHogTracker } = await import("./posthog-tracker");
  return createPostHogTracker({
    apiKey,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
}
