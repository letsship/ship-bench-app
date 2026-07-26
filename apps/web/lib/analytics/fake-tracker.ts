import type { AnalyticsTracker, CaptureEvent } from "./types";

// An in-memory analytics tracker for tests and the local fake-backends mode.
// It records every event it "captures" so tests can assert on the funnel
// without a vendor account or network.
export interface FakeTracker extends AnalyticsTracker {
  readonly captured: CaptureEvent[];
}

export function createFakeTracker(): FakeTracker {
  const captured: CaptureEvent[] = [];
  return {
    captured,
    capture(event) {
      captured.push(event);
    },
  };
}
