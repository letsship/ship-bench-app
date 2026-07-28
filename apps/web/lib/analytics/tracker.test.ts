import { afterEach, describe, expect, it } from "vitest";
import { createFakeTracker } from "./fake-tracker";
import { __setTestTracker, resolveTracker } from "./tracker";

describe("fake tracker", () => {
  it("records every captured event", async () => {
    const tracker = createFakeTracker();
    await tracker.capture({ distinctId: "m1", event: "booking_created", properties: {} });
    await tracker.capture({
      distinctId: "m2",
      event: "waitlist_joined",
      properties: { session_id: "cs1" },
    });
    expect(tracker.captured).toHaveLength(2);
    expect(tracker.captured[0]).toEqual({
      distinctId: "m1",
      event: "booking_created",
      properties: {},
    });
    expect(tracker.captured[1].properties.session_id).toBe("cs1");
  });
});

describe("tracker composition root", () => {
  afterEach(() => {
    __setTestTracker(null);
    delete process.env.USE_FAKE_BACKENDS;
  });

  it("returns the injected tracker after __setTestTracker", () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);
    expect(resolveTracker()).toBe(tracker);
  });

  it("falls back to the fake after __setTestTracker(null)", () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);
    __setTestTracker(null);
    process.env.USE_FAKE_BACKENDS = "1";
    expect(resolveTracker()).not.toBe(tracker);
    expect("captured" in resolveTracker()).toBe(true);
  });

  it("resolves the fake tracker under USE_FAKE_BACKENDS=1", () => {
    process.env.USE_FAKE_BACKENDS = "1";
    const tracker = resolveTracker();
    expect("captured" in tracker).toBe(true);
  });
});
