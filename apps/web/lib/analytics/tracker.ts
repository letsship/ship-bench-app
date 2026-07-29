import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { Tracker } from "./types";

// Resolve the request's analytics tracker. Production uses PostHog (a real
// PROJECT_API_KEY is required); the local fake-backends mode uses the in-memory
// recorder so the app runs with no vendor account. Tests inject their own via
// __setTestTracker.

let testTracker: Tracker | null = null;

export function __setTestTracker(tracker: Tracker | null): void {
  testTracker = tracker;
}

export function resolveTracker(): Tracker {
  if (testTracker) return testTracker;
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeTracker();
  }
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    return createFakeTracker();
  }
  return createPostHogTracker({
    apiKey,
    host: process.env.POSTHOG_HOST,
  });
}