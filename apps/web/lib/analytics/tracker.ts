import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { Tracker } from "./types";

// The app's analytics tracker. Production uses PostHog (a real token is
// required — a missing token is silently degraded to the fake tracker to keep
// analytics non-fatal). The local fake-backends mode uses the in-memory
// recorder so the app runs with no vendor account. Tests inject their own via
// __setTestTracker.

let testTracker: Tracker | null = null;

export function __setTestTracker(tracker: Tracker | null): void {
  testTracker = tracker;
}

function fakeBackendsEnabled(): boolean {
  return process.env.USE_FAKE_BACKENDS === "1";
}

// The fake tracker is a single instance shared across the whole process.
// It lives on globalThis so Next's separate server chunks see the SAME
// in-memory store.
const globalForFakes = globalThis as unknown as { __studiobookFakeTracker?: Tracker };

export function resolveTracker(): Tracker {
  if (testTracker) return testTracker;
  if (fakeBackendsEnabled()) {
    if (!globalForFakes.__studiobookFakeTracker) {
      globalForFakes.__studiobookFakeTracker = createFakeTracker();
    }
    return globalForFakes.__studiobookFakeTracker;
  }
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!projectToken || !host) {
    // Analytics is non-fatal; degrade to fake tracker silently if config is missing.
    return createFakeTracker();
  }
  return createPostHogTracker({ projectToken, host });
}
