import { afterEach, describe, expect, it } from "vitest";
import { BOOKING_CANCELLED, BOOKING_CREATED, WAITLIST_JOINED } from "./types";
import { createFakeTracker } from "./fake-tracker";
import { __setTestTracker, resolveTracker } from "./index";

describe("analytics tracking", () => {
  afterEach(() => {
    __setTestTracker(null);
  });

  it("createFakeTracker records captured events", async () => {
    const fake = createFakeTracker();
    await fake.capture({
      event: BOOKING_CREATED,
      distinctId: "member1",
      properties: { session_id: "session1" },
    });
    await fake.capture({
      event: WAITLIST_JOINED,
      distinctId: "member2",
      properties: { session_id: "session2" },
    });
    expect(fake.captured).toHaveLength(2);
    expect(fake.captured[0]).toEqual({
      event: BOOKING_CREATED,
      distinctId: "member1",
      properties: { session_id: "session1" },
    });
    expect(fake.captured[1]).toEqual({
      event: WAITLIST_JOINED,
      distinctId: "member2",
      properties: { session_id: "session2" },
    });
  });

  it("__setTestTracker(fake) makes resolveTracker return it", () => {
    const fake = createFakeTracker();
    __setTestTracker(fake);
    const resolved = resolveTracker();
    expect(resolved).toBe(fake);
  });

  it("__setTestTracker(null) restores default resolution", () => {
    const fake = createFakeTracker();
    __setTestTracker(fake);
    __setTestTracker(null);
    const resolved = resolveTracker();
    expect(resolved).not.toBe(fake);
  });

  it("captured events carry the expected event/distinctId/properties shape", async () => {
    const fake = createFakeTracker();
    __setTestTracker(fake);
    const tracker = resolveTracker();
    await tracker.capture({
      event: BOOKING_CANCELLED,
      distinctId: "member3",
      properties: { session_id: "session3", custom_prop: "value" },
    });
    expect(fake.captured).toHaveLength(1);
    const [event] = fake.captured;
    expect(event.event).toBe(BOOKING_CANCELLED);
    expect(event.distinctId).toBe("member3");
    expect(event.properties?.session_id).toBe("session3");
    expect(event.properties?.custom_prop).toBe("value");
  });
});
