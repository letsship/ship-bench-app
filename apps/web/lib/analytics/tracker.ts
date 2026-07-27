import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { Tracker } from "./types";

// Resolve the request's analytics tracker. Production uses PostHog (a real API
// key is required — a missing key is surfaced as an error, never silently
// degraded). The local fake-backends mode uses the in-memory recorder so the
// app runs with no vendor account. Tests inject their own via __setTestTracker.

let testTracker: Tracker | null = null;

export function __setTestTracker(tracker: Tracker | null): void {
  testTracker = tracker;
}

function fakeBackendsEnabled(): boolean {
  return process.env.USE_FAKE_BACKENDS === "1";
}

// A no-op tracker used as the default when the tracker is not provided.
const noOpTracker: Tracker = {
  async capture() {
    // No-op
  },
};

export function resolveTracker(): Tracker {
  if (testTracker) return testTracker;
  if (fakeBackendsEnabled()) {
    return createFakeTracker();
  }
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    throw new Error(
      "POSTHOG_API_KEY is not set. Set it for real analytics, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createPostHogTracker({
    apiKey,
    host: process.env.POSTHOG_HOST,
  });
}

export function noOpTracker_(): Tracker {
  return noOpTracker;
}
