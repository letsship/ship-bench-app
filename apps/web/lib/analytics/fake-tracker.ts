import type { CaptureEvent, Tracker } from "./types";

// An in-memory tracker for tests and the local fake-backends mode. It records
// every event it "captures" so tests can assert on the funnel without a
// vendor account or network.
export interface FakeTracker extends Tracker {
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
