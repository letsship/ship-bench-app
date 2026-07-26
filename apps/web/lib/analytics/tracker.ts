import { createFakeTracker } from "./fake-tracker";
import type { Tracker } from "./types";

// Resolve the request's tracker. Production builds a real PostHog client;
// `USE_FAKE_BACKENDS=1` (local dev, `next start` for e2e) uses the in-memory
// recorder; tests inject their own via __setTestTracker. This mirrors the
// notification provider seam in lib/notifications/provider.ts.

let testTracker: Tracker | null = null;

export function __setTestTracker(tracker: Tracker | null): void {
  testTracker = tracker;
}

export async function resolveTracker(): Promise<Tracker> {
  if (testTracker) return testTracker;
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeTracker();
  }
  const apiKey = process.env.POSTHOG_KEY;
  if (!apiKey) {
    throw new Error(
      "POSTHOG_KEY is not set. Set it for real analytics capture, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  const { createPostHogTracker } = await import("./posthog-tracker");
  return createPostHogTracker({
    apiKey,
    host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
  });
}
