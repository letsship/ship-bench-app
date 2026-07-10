import { describe, expect, it } from "vitest";
import { createFakeTracker } from "./fake-tracker";
import type { AnalyticsCaptureEvent } from "./types";

const event: AnalyticsCaptureEvent = {
  event: "booking_created",
  distinctId: "m1",
  properties: { session_id: "cs1" },
};

describe("fake tracker", () => {
  it("records captured events verbatim", async () => {
    const tracker = createFakeTracker();
    await tracker.capture(event);
    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0]).toBe(event);
  });
});
