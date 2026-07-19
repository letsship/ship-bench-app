import type { AnalyticsEvent, Tracker } from "./types";

export interface FakeTracker extends Tracker {
  readonly captured: AnalyticsEvent[];
}

export function createFakeTracker(): FakeTracker {
  const captured: AnalyticsEvent[] = [];
  return {
    captured,
    capture(event) {
      captured.push(event);
    },
  };
}
