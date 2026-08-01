import { analyticsEnv } from "@/lib/env";
import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { Tracker } from "./types";

let testTracker: Tracker | null = null;

export function __setTestTracker(tracker: Tracker | null): void {
  testTracker = tracker;
}

export function resolveTracker(): Tracker {
  if (testTracker) return testTracker;
  if (process.env.USE_FAKE_BACKENDS === "1") return createFakeTracker();
  const env = analyticsEnv();
  return createPostHogTracker({
    apiKey: env.POSTHOG_API_KEY,
    host: env.POSTHOG_HOST,
  });
}
