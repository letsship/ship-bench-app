import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { Tracker } from "./types";

// The tracker composition root + test seam, mirroring `lib/db/repos/index.ts`.
// Production uses the PostHog-backed tracker (a real project token is required
// — a missing token is surfaced as an error, never silently degraded, the way
// `notifications/provider.ts` throws on a missing RESEND_API_KEY). The local
// fake-backends mode uses the in-memory recorder so the app runs with no vendor
// account. Tests inject their own recording tracker via `__setTestTracker`.
//
// This is the single seam that a PostHog→other-vendor migration replaces, and
// it is the only place the real PostHog client is constructed — service and
// domain code depend on the `Tracker` interface, never on a `posthog` package.

let testTracker: Tracker | null = null;

export function __setTestTracker(tracker: Tracker | null): void {
  testTracker = tracker;
}

function fakeBackendsEnabled(): boolean {
  return process.env.USE_FAKE_BACKENDS === "1";
}

export function resolveTracker(): Tracker {
  if (testTracker) return testTracker;
  if (fakeBackendsEnabled()) return createFakeTracker();
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set. Set it for real analytics, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createPostHogTracker({
    token,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
}
