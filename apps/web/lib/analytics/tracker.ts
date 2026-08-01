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

const globalForAnalytics = globalThis as unknown as { __studiobookFakeTracker?: Tracker };

export function resolveTracker(): Tracker {
  if (testTracker) return testTracker;
  if (fakeBackendsEnabled()) {
    if (!globalForAnalytics.__studiobookFakeTracker) {
      globalForAnalytics.__studiobookFakeTracker = createFakeTracker();
    }
    return globalForAnalytics.__studiobookFakeTracker;
  }

  const token = process.env.POSTHOG_PROJECT_TOKEN;
  if (!token) {
    throw new Error(
      "POSTHOG_PROJECT_TOKEN is not set. Set it for real analytics, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createPostHogTracker({
    token,
    host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
  });
}
