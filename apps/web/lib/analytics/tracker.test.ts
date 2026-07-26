import { afterEach, describe, expect, it } from "vitest";
import { createFakeTracker } from "./fake-tracker";
import { __setTestTracker, resolveTracker } from "./tracker";

describe("fake tracker", () => {
  it("records captured events", () => {
    const tracker = createFakeTracker();
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

describe("resolveTracker", () => {
  afterEach(() => {
    __setTestTracker(null);
  });

  it("returns the injected test tracker when set", async () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);
    expect(await resolveTracker()).toBe(tracker);
  });

  it("falls back to the fake tracker under USE_FAKE_BACKENDS once the test tracker is cleared", async () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);
    __setTestTracker(null);
    const previous = process.env.USE_FAKE_BACKENDS;
    process.env.USE_FAKE_BACKENDS = "1";
    try {
      const resolved = await resolveTracker();
      expect(resolved).not.toBe(tracker);
      expect(resolved.name).toBe("fake");
    } finally {
      process.env.USE_FAKE_BACKENDS = previous;
    }
  });

  it("throws when no test tracker, fake backends, or POSTHOG_KEY are available", async () => {
    const previousFake = process.env.USE_FAKE_BACKENDS;
    const previousKey = process.env.POSTHOG_KEY;
    delete process.env.USE_FAKE_BACKENDS;
    delete process.env.POSTHOG_KEY;
    try {
      await expect(resolveTracker()).rejects.toThrow(/POSTHOG_KEY/);
    } finally {
      process.env.USE_FAKE_BACKENDS = previousFake;
      process.env.POSTHOG_KEY = previousKey;
    }
  });
});
