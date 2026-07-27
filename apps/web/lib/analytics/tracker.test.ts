import { afterEach, describe, expect, it } from "vitest";
import { __setTestTracker, resolveTracker } from "./index";
import { createRecordingTracker } from "./fake-tracker";

describe("analytics module", () => {
  afterEach(() => {
    __setTestTracker(null);
  });

  it("recording tracker records capture calls and allows assertion", async () => {
    const tracker = createRecordingTracker();
    await tracker.capture({
      event: "booking_created",
      distinctId: "m1",
      properties: { session_id: "cs1" },
    });
    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0]).toEqual({
      event: "booking_created",
      distinctId: "m1",
      properties: { session_id: "cs1" },
    });
  });

  it("__setTestTracker makes resolveTracker return the injected tracker", async () => {
    const testTracker = createRecordingTracker();
    __setTestTracker(testTracker);
    const resolved = resolveTracker();
    await resolved.capture({
      event: "waitlist_joined",
      distinctId: "m2",
      properties: { session_id: "cs2" },
    });
    expect(testTracker.captured).toHaveLength(1);
  });

  it("__setTestTracker(null) restores default resolution", async () => {
    const testTracker = createRecordingTracker();
    __setTestTracker(testTracker);
    __setTestTracker(null);
    const resolved = resolveTracker();
    // With USE_FAKE_BACKENDS not set and no POSTHOG_KEY, this should be
    // a no-op tracker, not our test tracker. We can't directly assert
    // it's different, but we can verify it doesn't mutate testTracker.
    await resolved.capture({
      event: "booking_cancelled",
      distinctId: "m3",
      properties: { session_id: "cs3" },
    });
    expect(testTracker.captured).toHaveLength(0);
  });
});
