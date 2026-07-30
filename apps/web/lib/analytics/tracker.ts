import { clientEnv } from "@/lib/env";
import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { Tracker } from "./types";

// The analytics composition root and test seam, mirroring `lib/db/repos/index.ts`.
// Production builds the real PostHog client ONLY here; `USE_FAKE_BACKENDS=1`
// (local dev, e2e) uses the in-memory recorder; tests inject their own via
// `__setTestTracker`. Service and domain code depend on the `Tracker`
// interface, never on `posthog-node` — this is the single seam a vendor swap
// replaces.

let testTracker: Tracker | null = null;

export function __setTestTracker(tracker: Tracker | null): void {
  testTracker = tracker;
}

function fakeBackendsEnabled(): boolean {
  return process.env.USE_FAKE_BACKENDS === "1";
}

// The fake tracker is a single shared instance per process so a route handler
// that captures and a test that asserts see the SAME recorded events.
const globalForFakes = globalThis as unknown as { __studiobookFakeTracker?: Tracker };

export function resolveTracker(): Tracker {
  if (testTracker) return testTracker;
  if (fakeBackendsEnabled()) {
    if (!globalForFakes.__studiobookFakeTracker) {
      globalForFakes.__studiobookFakeTracker = createFakeTracker();
    }
    return globalForFakes.__studiobookFakeTracker;
  }
  const env = clientEnv();
  const token = env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!token) {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_KEY is not set. Set it for real analytics capture, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createPostHogTracker({ token, host: env.NEXT_PUBLIC_POSTHOG_HOST });
}
