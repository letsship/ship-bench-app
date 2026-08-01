import { afterEach, describe, expect, it } from "vitest";
import { createFakeTracker } from "./fake-tracker";
import { __setTestTracker, resolveTracker } from "./tracker";

describe("analytics tracker seam", () => {
  afterEach(() => {
    __setTestTracker(null);
  });

  it("records events with the fake tracker", async () => {
    const tracker = createFakeTracker();
    await tracker.capture({
      event: "booking_created",
      distinctId: "m1",
      properties: { session_id: "cs1" },
    });
    expect(tracker.captured).toEqual([
      { event: "booking_created", distinctId: "m1", properties: { session_id: "cs1" } },
    ]);
  });

  it("resolves an injected tracker and restores the default after reset", () => {
    const previousFakeMode = process.env.USE_FAKE_BACKENDS;
    process.env.USE_FAKE_BACKENDS = "1";
    const tracker = createFakeTracker();
    try {
      __setTestTracker(tracker);
      expect(resolveTracker()).toBe(tracker);
      __setTestTracker(null);
      expect(resolveTracker()).not.toBe(tracker);
    } finally {
      if (previousFakeMode === undefined) delete process.env.USE_FAKE_BACKENDS;
      else process.env.USE_FAKE_BACKENDS = previousFakeMode;
    }
  });
});
