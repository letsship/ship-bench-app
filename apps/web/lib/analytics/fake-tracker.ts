import type { CaptureEvent, Tracker } from "./types";

export interface FakeTracker extends Tracker {
  readonly captured: CaptureEvent[];
}

export function createFakeTracker(): FakeTracker {
  const captured: CaptureEvent[] = [];
  return {
    captured,
    capture(event) {
      captured.push(event);
    },
  };
}
