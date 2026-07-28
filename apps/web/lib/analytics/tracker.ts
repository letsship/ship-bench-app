import { createFakeTracker } from "./fake-tracker";
import { createPosthogTracker } from "./posthog-tracker";
import type { Tracker } from "./types";

// The app's analytics tracker. Production uses PostHog (a real API key is
// required — a missing key is surfaced as an error, never silently degraded).
// The local fake-backends mode uses the in-memory recorder so the app runs with
// no vendor account. Tests inject their own via __setTestTracker.

let testTracker: Tracker | null = null;

export function __setTestTracker(tracker: Tracker | null): void {
  testTracker = tracker;
}

export function resolveTracker(): Tracker {
  if (testTracker) return testTracker;
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeTracker();
  }
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ?? process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    throw new Error(
      "POSTHOG_API_KEY is not set. Set it for real analytics, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createPosthogTracker({
    apiKey,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
}