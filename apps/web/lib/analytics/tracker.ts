import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { Tracker } from "./types";

// The tracker composition root and test seam, mirroring the notification
// provider seam: production builds the real PostHog adapter here (the only
// place the vendor client is constructed), the local fake-backends mode uses
// the in-memory recorder, and tests inject their own via __setTestTracker.

let testTracker: Tracker | null = null;

export function __setTestTracker(tracker: Tracker | null): void {
  testTracker = tracker;
}

let cachedTracker: Tracker | null = null;

export function resolveTracker(): Tracker {
  if (testTracker) return testTracker;
  if (process.env.USE_FAKE_BACKENDS === "1") {
    if (!cachedTracker) cachedTracker = createFakeTracker();
    return cachedTracker;
  }
  if (!cachedTracker) {
    const apiKey = process.env.POSTHOG_KEY;
    if (!apiKey) {
      throw new Error(
        "POSTHOG_KEY is not set. Set it for real analytics, or run with USE_FAKE_BACKENDS=1.",
      );
    }
    cachedTracker = createPostHogTracker({ apiKey, host: process.env.POSTHOG_HOST });
  }
  return cachedTracker;
}
