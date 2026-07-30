import type { CaptureEvent, Tracker } from "./types";

// An in-memory recording tracker for tests and the local fake-backends mode.
// It records every event it "captures" so tests can assert on the funnel
// (booking/waitlist/cancellation) without a vendor account or network — the
// analytics mirror of `lib/notifications/fake-provider.ts`.
export interface FakeTracker extends Tracker {
  readonly captured: CaptureEvent[];
}

export function createFakeTracker(): FakeTracker {
  const captured: CaptureEvent[] = [];
  return {
    name: "fake",
    captured,
    capture(event: CaptureEvent) {
      captured.push(event);
    },
  };
}
