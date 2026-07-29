import { afterEach, describe, expect, it, vi } from "vitest";
import { createRecordingTracker } from "./fake-tracker";
import { __setTestTracker, resolveTracker } from "./tracker";

describe("recording tracker", () => {
  it("records every captured event in order", async () => {
    const tracker = createRecordingTracker();
    await tracker.capture({
      event: "booking_created",
      distinctId: "m1",
      properties: { session_id: "cs1" },
    });
    await tracker.capture({
      event: "booking_cancelled",
      distinctId: "m1",
      properties: { session_id: "cs1" },
    });
    expect(tracker.captured.map((event) => event.event)).toEqual([
      "booking_created",
      "booking_cancelled",
    ]);
  });
});

describe("tracker composition root (__setTestTracker seam)", () => {
  afterEach(() => {
    __setTestTracker(null);
    vi.unstubAllEnvs();
  });

  it("returns the injected test tracker while set", () => {
    const tracker = createRecordingTracker();
    __setTestTracker(tracker);
    expect(resolveTracker()).toBe(tracker);
  });

  it("restores default resolution when cleared", () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
    const injected = createRecordingTracker();
    __setTestTracker(injected);
    __setTestTracker(null);
    const resolved = resolveTracker();
    expect(resolved).not.toBe(injected);
    // Default resolution under fake backends is a fresh in-memory recorder.
    expect(resolved).toHaveProperty("captured", []);
  });
});
