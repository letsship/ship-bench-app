import type { AnalyticsEvent, Tracker } from "./types";

// An in-memory tracker for tests and the local fake-backends mode. It records
// every event it "captures" so tests can assert on the funnel without a vendor
// account or network.
export interface RecordingTracker extends Tracker {
  readonly captured: AnalyticsEvent[];
}

export function createRecordingTracker(): RecordingTracker {
  const captured: AnalyticsEvent[] = [];
  return {
    captured,
    async capture(event) {
      captured.push(event);
    },
  };
}
