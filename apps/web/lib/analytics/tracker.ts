import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { AnalyticsTracker } from "./types";

// Resolve the request's analytics tracker. Production uses PostHog; the local
// fake-backends mode uses the in-memory recorder; tests inject their own via
// __setTestTracker. This is the single seam a vendor swap would replace.

let testTracker: AnalyticsTracker | null = null;

export function __setTestTracker(tracker: AnalyticsTracker | null): void {
  testTracker = tracker;
}

function fakeBackendsEnabled(): boolean {
  return process.env.USE_FAKE_BACKENDS === "1";
}

// The fake tracker is a single shared instance for the whole process. It
// lives on globalThis so Next's separate server chunks see the SAME recorder.
const globalForFakes = globalThis as unknown as { __studiobookFakeTracker?: AnalyticsTracker };

export function resolveTracker(): AnalyticsTracker {
  if (testTracker) return testTracker;
  if (fakeBackendsEnabled()) {
    if (!globalForFakes.__studiobookFakeTracker) {
      globalForFakes.__studiobookFakeTracker = createFakeTracker();
    }
    return globalForFakes.__studiobookFakeTracker;
  }
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!projectToken) {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set. Set it for real analytics capture, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createPostHogTracker({
    projectToken,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
}
