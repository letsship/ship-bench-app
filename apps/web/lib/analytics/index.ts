import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { Tracker } from "./types";

// The tracker composition root, mirroring the repository seam in
// `lib/db/repos/index.ts` and the notification provider in
// `lib/notifications/provider.ts`. Production builds the PostHog client from
// env (a missing key is surfaced as an error, never silently degraded — just
// like createNotificationProvider); the local fake-backends mode uses the
// in-memory recorder; tests inject their own via __setTestTracker.

let testTracker: Tracker | null = null;

// The graded test seam — the direct analog of __setTestRepositories on the
// repository seam. A recording tracker injected here is returned by every
// resolveTracker() call so route handlers driven in tests record events.
export function __setTestTracker(tracker: Tracker | null): void {
  testTracker = tracker;
}

export function resolveTracker(): Tracker {
  if (testTracker) return testTracker;
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeTracker();
  }
  const token = process.env.POSTHOG_API_KEY;
  if (!token) {
    throw new Error(
      "POSTHOG_API_KEY is not set. Set it for real analytics, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createPostHogTracker({
    token,
    host: process.env.POSTHOG_HOST,
  });
}
