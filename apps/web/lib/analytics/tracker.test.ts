import { afterEach, describe, expect, it } from "vitest";
import { __setTestTracker, resolveTracker } from "./index";
import { createRecordingTracker } from "./fake-tracker";

describe("recording tracker", () => {
  it("records every capture() call", () => {
    const tracker = createRecordingTracker();
    tracker.capture({
      distinctId: "m1",
      event: "booking_created",
      properties: { session_id: "cs1" },
    });
    expect(tracker.captured).toEqual([
      { distinctId: "m1", event: "booking_created", properties: { session_id: "cs1" } },
    ]);
  });
});

describe("analytics seam", () => {
  afterEach(() => {
    __setTestTracker(null);
  });

  it("__setTestTracker makes resolveTracker() return the injected tracker", () => {
    const tracker = createRecordingTracker();
    __setTestTracker(tracker);
    expect(resolveTracker()).toBe(tracker);
  });
});
