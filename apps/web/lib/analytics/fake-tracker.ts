import type { AnalyticsEvent, AnalyticsTracker } from "./types";

export interface FakeTracker extends AnalyticsTracker {
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
