import type { AnalyticsTracker, CaptureEvent } from "./types";

// An in-memory analytics tracker for tests. It records every event it captures
// so tests can assert on delivery without a PostHog account or network.
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
