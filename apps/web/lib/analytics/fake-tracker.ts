import type { AnalyticsEvent, AnalyticsTracker } from "./types";

// An in-memory analytics tracker for tests and the local fake-backends mode.
// It records every captured event so tests can assert on funnel instrumentation
// without a vendor account or network.
export interface FakeTracker extends AnalyticsTracker {
  readonly captured: AnalyticsEvent[];
}

export function createFakeTracker(): FakeTracker {
  const captured: AnalyticsEvent[] = [];
  return {
    captured,
    async capture(event) {
      captured.push(event);
    },
  };
}
