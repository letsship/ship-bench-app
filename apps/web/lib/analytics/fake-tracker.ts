import type { TrackedEvent, Tracker } from "./types";

// An in-memory recording tracker for tests and the local fake-backends mode.
// It records every event it "captures" so tests can assert on the funnel
// without a vendor account or network — the analytics analog of the fake
// notification provider.
export interface FakeTracker extends Tracker {
  readonly captured: TrackedEvent[];
}

export function createFakeTracker(): FakeTracker {
  const captured: TrackedEvent[] = [];
  return {
    name: "fake",
    captured,
    async capture(event) {
      captured.push(event);
    },
  };
}
