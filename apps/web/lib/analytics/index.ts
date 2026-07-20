import { createFakeTracker } from "./fake-tracker";
import { createPosthogTracker } from "./posthog-tracker";
import type { Tracker } from "./types";

// Resolve the request's tracker. Production uses the PostHog adapter with a real
// API key; `USE_FAKE_BACKENDS=1` (local dev) uses a recording in-memory tracker;
// tests inject their own via __setTestTracker. This is the single seam that
// controls analytics provider swapping.

let testTracker: Tracker | null = null;

export function __setTestTracker(tracker: Tracker | null): void {
  testTracker = tracker;
}

function fakeBackendsEnabled(): boolean {
  return process.env.USE_FAKE_BACKENDS === "1";
}

// The fake tracker is a single instance shared across the whole process so that
// in-memory captured events persist across requests. It lives on globalThis so
// Next's separate server chunks (a route handler that writes and another that
// reads) see the SAME in-memory store.
const globalForFakes = globalThis as unknown as { __studiobookFakeTracker?: Tracker };

export function resolveTracker(): Tracker {
  if (testTracker) return testTracker;
  if (fakeBackendsEnabled()) {
    if (!globalForFakes.__studiobookFakeTracker) {
      globalForFakes.__studiobookFakeTracker = createFakeTracker();
    }
    return globalForFakes.__studiobookFakeTracker;
  }
  const projectToken = process.env.POSTHOG_PROJECT_TOKEN;
  const host = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";
  if (!projectToken) {
    throw new Error(
      "POSTHOG_PROJECT_TOKEN is not set. Set it for real analytics, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createPosthogTracker({ projectToken, host });
}
