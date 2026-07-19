import { afterEach, describe, expect, it } from "vitest";
import { __setTestTracker, resolveTracker } from "./tracker";
import { createFakeTracker } from "./fake-tracker";

describe("analytics seam (__setTestTracker + resolveTracker)", () => {
  afterEach(() => {
    __setTestTracker(null);
  });

  it("returns a fake tracker when no test tracker is set and fake backends are disabled", () => {
    const tracker = resolveTracker();
    expect(tracker).toBeDefined();
  });

  it("__setTestTracker injects a test tracker", async () => {
    const fake = createFakeTracker();
    __setTestTracker(fake);
    const resolved = resolveTracker();
    expect(resolved).toBe(fake);
  });

  it("a fake tracker records captured events", async () => {
    const fake = createFakeTracker();
    await fake.capture({
      event: "booking_created",
      distinctId: "member-123",
      properties: { session_id: "session-456" },
    });
    expect(fake.captured).toHaveLength(1);
    expect(fake.captured[0]).toMatchObject({
      event: "booking_created",
      distinctId: "member-123",
      properties: { session_id: "session-456" },
    });
  });

  it("a fake tracker records multiple events in order", async () => {
    const fake = createFakeTracker();
    await fake.capture({
      event: "booking_created",
      distinctId: "m1",
      properties: { session_id: "s1" },
    });
    await fake.capture({
      event: "booking_cancelled",
      distinctId: "m2",
      properties: { session_id: "s2" },
    });
    expect(fake.captured).toHaveLength(2);
    expect(fake.captured[0].event).toBe("booking_created");
    expect(fake.captured[1].event).toBe("booking_cancelled");
  });

  it("__setTestTracker(null) clears the injected tracker", async () => {
    const fake1 = createFakeTracker();
    __setTestTracker(fake1);
    __setTestTracker(null);
    const resolved = resolveTracker();
    expect(resolved).not.toBe(fake1);
  });
});
