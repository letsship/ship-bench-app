import { createFakeTracker } from "./fake-tracker";
import { createPosthogTracker } from "./posthog-tracker";
import type { Tracker } from "./types";

// Resolve the request's tracker. Production uses the real PostHog client;
// USE_FAKE_BACKENDS=1 (local dev, next start for e2e) uses an in-memory
// recording tracker; tests inject their own via __setTestTracker. This is the
// single seam analogous to resolveRepositories.

let testTracker: Tracker | null = null;

export function __setTestTracker(tracker: Tracker | null): void {
  testTracker = tracker;
}

function fakeBackendsEnabled(): boolean {
  return process.env.USE_FAKE_BACKENDS === "1";
}

// The fake tracker is a single instance shared across the whole process.
// It lives on globalThis so Next's separate server chunks see the SAME
// in-memory recorder.
const globalForFakes = globalThis as unknown as { __studiobookFakeTracker?: Tracker };

export async function resolveTracker(): Promise<Tracker> {
  if (testTracker) return testTracker;
  if (fakeBackendsEnabled()) {
    if (!globalForFakes.__studiobookFakeTracker) {
      globalForFakes.__studiobookFakeTracker = createFakeTracker();
    }
    return globalForFakes.__studiobookFakeTracker;
  }
  const { serverEnv } = await import("@/lib/env");
  const env = serverEnv();
  const apiKey = env.POSTHOG_API_KEY;
  if (!apiKey) {
    throw new Error(
      "POSTHOG_API_KEY is not set. Set it for real analytics, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createPosthogTracker(apiKey, env.POSTHOG_HOST);
}
