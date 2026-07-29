import { createRecordingTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { Tracker } from "./types";

// The app's analytics tracker — the composition root, and the ONLY place the
// concrete PostHog client is constructed. Production uses PostHog (a missing
// project token is surfaced as an error, never silently degraded — the same
// rule as the notification provider). The local fake-backends mode uses the
// in-memory recorder; tests inject their own via __setTestTracker, mirroring
// __setTestRepositories on the repository seam.

let testTracker: Tracker | null = null;

export function __setTestTracker(tracker: Tracker | null): void {
  testTracker = tracker;
}

export function resolveTracker(): Tracker {
  if (testTracker) return testTracker;
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createRecordingTracker();
  }
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!projectToken) {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set. Set it for real analytics, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createPostHogTracker({
    projectToken,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
}
