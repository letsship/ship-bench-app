import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { Tracker } from "./types";

// The app's analytics tracker. Production uses PostHog (a real API key is
// required to construct it); the local fake-backends mode and tests use the
// in-memory recorder so the app and suite run with no vendor account. This is
// the single seam a PostHog→other-vendor migration replaces.

let testTracker: Tracker | null = null;

export function __setTestTracker(tracker: Tracker | null): void {
  testTracker = tracker;
}

export function resolveTracker(): Tracker {
  if (testTracker) return testTracker;
  const apiKey = process.env.POSTHOG_API_KEY;
  if (process.env.USE_FAKE_BACKENDS === "1" || !apiKey) {
    return createFakeTracker();
  }
  return createPostHogTracker({ apiKey, host: process.env.POSTHOG_HOST });
}
