import type { CaptureEvent, Tracker } from "./types";

// An in-memory analytics tracker for tests and the local fake-backends mode.
// It records every event it "captures" so tests can assert on analytics without
// a PostHog account or network.

export interface RecordingTracker extends Tracker {
  readonly captured: CaptureEvent[];
}

export function createFakeTracker(): RecordingTracker {
  const captured: CaptureEvent[] = [];
  return {
    name: "fake",
    captured,
    async capture(event: CaptureEvent): Promise<void> {
      captured.push(event);
    },
  };
}