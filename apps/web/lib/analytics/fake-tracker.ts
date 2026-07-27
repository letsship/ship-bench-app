import type { CaptureEvent, Tracker } from "./types";

// An in-memory tracker for tests and the local fake-backends mode. It records
// every capture() call so tests can assert on emitted events without a vendor
// account or network.
export interface RecordingTracker extends Tracker {
  readonly captured: CaptureEvent[];
}

export function createRecordingTracker(): RecordingTracker {
  const captured: CaptureEvent[] = [];
  return {
    captured,
    capture(event) {
      captured.push(event);
    },
  };
}
