import type { CaptureInput, Tracker } from "./types";

// An in-memory recording tracker for tests and the local fake-backends mode.
// It records every event it "captures" so tests can assert on the funnel
// without a vendor account or network — mirroring `createFakeProvider` for the
// notification seam. Used as the recording tracker injected via
// `__setTestTracker` in the analytics service tests.

export interface RecordedEvent {
  event: string;
  distinctId: string;
  properties: Record<string, unknown>;
}

export interface FakeTracker extends Tracker {
  readonly events: RecordedEvent[];
}

export function createFakeTracker(): FakeTracker {
  const events: RecordedEvent[] = [];
  return {
    name: "fake",
    events,
    capture({ event, distinctId, properties }: CaptureInput) {
      events.push({ event, distinctId, properties: { ...properties } });
    },
  };
}
