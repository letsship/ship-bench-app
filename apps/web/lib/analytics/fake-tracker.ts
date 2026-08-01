import type { AnalyticsEvent, Tracker } from "./types";

// An in-memory tracker for tests and the local fake-backends mode. It records
// every event it "captures" so tests can assert on analytics without a vendor
// account or network.
export interface FakeTracker extends Tracker {
  readonly captured: AnalyticsEvent[];
}

export function createFakeTracker(): FakeTracker {
  const captured: AnalyticsEvent[] = [];
  return {
    name: "fake",
    captured,
    async capture(event) {
      captured.push(event);
    },
  };
}
