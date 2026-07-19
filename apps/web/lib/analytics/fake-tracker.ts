import type { AnalyticsTracker, CaptureEvent } from "./types";

export interface FakeTracker extends AnalyticsTracker {
  readonly captured: CaptureEvent[];
}

export function createFakeTracker(): FakeTracker {
  const captured: CaptureEvent[] = [];
  return {
    captured,
    async capture(event) {
      captured.push(event);
    },
  };
}
