import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { Tracker } from "./types";

// Resolve the analytics tracker. Production uses PostHog (a real API key is
// required — a missing key is surfaced as an error, never silently degraded).
// The local fake-backends mode uses the in-memory recorder so the app runs with
// no vendor account. Tests inject their own via __setTestTracker.

let testTracker: Tracker | null = null;

export function __setTestTracker(tracker: Tracker | null): void {
  testTracker = tracker;
}

function fakeBackendsEnabled(): boolean {
  return process.env.USE_FAKE_BACKENDS === "1";
}

// The fake tracker is a single instance shared across the whole process.
// It lives on globalThis so Next's separate server chunks see the SAME instance.
const globalForFakes = globalThis as unknown as { __studiobookFakeTracker?: Tracker };

export async function resolveTracker(): Promise<Tracker> {
  if (testTracker) return testTracker;
  if (fakeBackendsEnabled()) {
    if (!globalForFakes.__studiobookFakeTracker) {
      globalForFakes.__studiobookFakeTracker = createFakeTracker();
    }
    return globalForFakes.__studiobookFakeTracker;
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
