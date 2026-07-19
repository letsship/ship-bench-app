import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { Tracker } from "./types";

let testTracker: Tracker | null = null;

export function __setTestTracker(tracker: Tracker | null): void {
  testTracker = tracker;
}

function fakeBackendsEnabled(): boolean {
  return process.env.USE_FAKE_BACKENDS === "1";
}

// The tracker is a singleton shared across the whole process.
// It lives on globalThis so Next's separate server chunks see the SAME instance.
const globalForTrackers = globalThis as unknown as { __studiobookTracker?: Tracker };

export function resolveTracker(): Tracker {
  if (testTracker) return testTracker;
  if (fakeBackendsEnabled()) {
    if (!globalForTrackers.__studiobookTracker) {
      globalForTrackers.__studiobookTracker = createFakeTracker();
    }
    return globalForTrackers.__studiobookTracker;
  }
  const apiKey = process.env.POSTHOG_KEY;
  const host = process.env.POSTHOG_HOST;
  if (!apiKey || !host) {
    throw new Error(
      "POSTHOG_KEY and POSTHOG_HOST are not set. Set them for real analytics, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createPostHogTracker({ apiKey, host });
}
