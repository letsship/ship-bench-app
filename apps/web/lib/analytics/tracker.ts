import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { Tracker } from "./types";

// Resolve the request's analytics tracker. Production uses PostHog; the local
// fake-backends mode uses the in-memory recorder so the app runs with no vendor
// account; tests inject their own via __setTestTracker. This is the single seam
// a PostHog→other-vendor migration replaces, and the only place the real
// PostHog client is constructed — mirroring createNotificationProvider.

let testTracker: Tracker | null = null;

export function __setTestTracker(tracker: Tracker | null): void {
  testTracker = tracker;
}

export function resolveTracker(): Tracker {
  if (testTracker) return testTracker;
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeTracker();
  }
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set. Set it for real analytics, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createPostHogTracker({
    token,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
  });
}
