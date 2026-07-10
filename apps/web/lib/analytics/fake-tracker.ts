import type { AnalyticsCaptureEvent, AnalyticsTracker } from "./types";

// An in-memory analytics tracker for tests and the local fake-backends mode.
// It records every event it "captures" so tests can assert on funnel events
// without a vendor account or network.
export interface FakeTracker extends AnalyticsTracker {
  readonly captured: AnalyticsCaptureEvent[];
}

export function createFakeTracker(): FakeTracker {
  const captured: AnalyticsCaptureEvent[] = [];
  return {
    captured,
    async capture(event) {
      captured.push(event);
    },
  };
}
