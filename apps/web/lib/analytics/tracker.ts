import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { AnalyticsTracker } from "./types";

let testTracker: AnalyticsTracker | null = null;

export function __setTestTracker(tracker: AnalyticsTracker | null): void {
  testTracker = tracker;
}

const globalForFakes = globalThis as unknown as { __studiobookFakeTracker?: AnalyticsTracker };

export function resolveTracker(): AnalyticsTracker {
  if (testTracker) return testTracker;
  if (process.env.USE_FAKE_BACKENDS === "1") {
    globalForFakes.__studiobookFakeTracker ??= createFakeTracker();
    return globalForFakes.__studiobookFakeTracker;
  }

  const apiKey = process.env.POSTHOG_KEY;
  if (!apiKey) {
    throw new Error(
      "POSTHOG_KEY is not set. Set it for real analytics delivery, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createPostHogTracker({
    apiKey,
    host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
  });
}
