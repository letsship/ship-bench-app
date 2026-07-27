import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { AnalyticsTracker } from "./types";

// Resolve the request's analytics tracker. Production uses the PostHog-backed
// implementation; `USE_FAKE_BACKENDS=1` (local dev, `next start` for e2e) uses a
// recording in-memory fake; tests inject their own via __setTestTracker. This is
// the single seam that a PostHog→other-vendor migration replaces.

let testTracker: AnalyticsTracker | null = null;

export function __setTestTracker(tracker: AnalyticsTracker | null): void {
  testTracker = tracker;
}

function fakeBackendsEnabled(): boolean {
  return process.env.USE_FAKE_BACKENDS === "1";
}

// The fake tracker is a single instance shared across the whole process.
// It lives on globalThis so Next's separate server chunks see the SAME in-memory store.
const globalForFakes = globalThis as unknown as { __studiobookFakeTracker?: AnalyticsTracker };

export function resolveTracker(): AnalyticsTracker {
  if (testTracker) return testTracker;
  if (fakeBackendsEnabled()) {
    if (!globalForFakes.__studiobookFakeTracker) {
      globalForFakes.__studiobookFakeTracker = createFakeTracker();
    }
    return globalForFakes.__studiobookFakeTracker;
  }

  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  // In test environments without PostHog config, use the fake tracker
  if (!token || !host) {
    if (!globalForFakes.__studiobookFakeTracker) {
      globalForFakes.__studiobookFakeTracker = createFakeTracker();
    }
    return globalForFakes.__studiobookFakeTracker;
  }

  return createPostHogTracker({ token, host });
}
