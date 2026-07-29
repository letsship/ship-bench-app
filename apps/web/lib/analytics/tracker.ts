import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { Tracker } from "./types";

// The analytics composition root, mirroring `lib/db/repos/index.ts` (and the
// `createNotificationProvider` factory). Production constructs the real
// PostHog client here — the only place a `posthog` package is referenced.
// `USE_FAKE_BACKENDS=1` (local dev, e2e) uses the in-memory recorder. Tests
// inject their own tracker via `__setTestTracker`, consulted first by
// `resolveTracker()` — exactly mirroring `__setTestRepositories`.

let testTracker: Tracker | null = null;

export function __setTestTracker(tracker: Tracker | null): void {
  testTracker = tracker;
}

function fakeBackendsEnabled(): boolean {
  return process.env.USE_FAKE_BACKENDS === "1";
}

// The fake tracker is a single instance shared across the whole process when
// fake backends are enabled (mirroring `globalForFakes` for repositories), so
// every request sees the same recorded funnel.
const globalForFakes = globalThis as unknown as { __studiobookFakeTracker?: Tracker };

let cachedRealTracker: Tracker | null = null;

export function createTracker(): Tracker {
  if (fakeBackendsEnabled()) {
    if (!globalForFakes.__studiobookFakeTracker) {
      globalForFakes.__studiobookFakeTracker = createFakeTracker();
    }
    return globalForFakes.__studiobookFakeTracker;
  }
  if (!cachedRealTracker) {
    const apiKey = process.env.POSTHOG_API_KEY;
    if (!apiKey) {
      throw new Error(
        "POSTHOG_API_KEY is not set. Set it for real analytics, or run with USE_FAKE_BACKENDS=1.",
      );
    }
    cachedRealTracker = createPostHogTracker({
      apiKey,
      host: process.env.POSTHOG_HOST,
    });
  }
  return cachedRealTracker;
}

export function resolveTracker(): Tracker {
  if (testTracker) return testTracker;
  return createTracker();
}
