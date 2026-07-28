import type { AnalyticsEvent, Tracker } from "./types";

// An in-memory recording tracker for tests and the local fake-backends mode.
// It records every event it "captures" so tests can assert on delivery without a
// vendor account or network.
export interface FakeTracker extends Tracker {
  readonly captured: AnalyticsEvent[];
}

export function createFakeTracker(): FakeTracker {
  const captured: AnalyticsEvent[] = [];
  return {
    name: "fake",
    captured,
    capture(event) {
      captured.push(event);
    },
  };
}