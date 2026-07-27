import { createRecordingTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { Tracker } from "./types";

// The app's tracker for analytics. Production uses PostHog (real API key and
// host are required — a missing key is surfaced as an error, never silently
// degraded). The local fake-backends mode uses the in-memory recorder so
// the app runs with no vendor account.

let testTracker: Tracker | null = null;

export function __setTestTracker(tracker: Tracker | null): void {
  testTracker = tracker;
}

function fakeBackendsEnabled(): boolean {
  return process.env.USE_FAKE_BACKENDS === "1";
}

export function resolveTracker(): Tracker {
  if (testTracker) return testTracker;
  if (fakeBackendsEnabled()) {
    return createRecordingTracker();
  }
  const apiKey = process.env.POSTHOG_KEY;
  const host = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";
  if (!apiKey) {
    // PostHog is optional; if not configured, create a no-op tracker that
    // discards events silently.
    return {
      async capture() {
        // no-op
      },
    };
  }
  return createPostHogTracker({ apiKey, host });
}
