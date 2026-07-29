import { afterEach, describe, expect, it } from "vitest";
import { createFakeTracker } from "./fake-tracker";
import { resolveTracker, __setTestTracker } from "./tracker";
import { bookingCancelled, bookingCreated, waitlistJoined } from "./events";

describe("__setTestTracker seam", () => {
  afterEach(() => {
    __setTestTracker(null);
  });

  it("returns the injected tracker when set", () => {
    const injected = createFakeTracker();
    __setTestTracker(injected);
    expect(resolveTracker()).toBe(injected);
  });

  it("returns a new fake tracker when cleared", () => {
    __setTestTracker(createFakeTracker());
    __setTestTracker(null);
    const tracker = resolveTracker();
    expect(tracker.name).toBe("fake");
  });
});

describe("fake tracker", () => {
  it("records captured events in order", async () => {
    const tracker = createFakeTracker();
    await tracker.capture({ event: "booking_created", distinctId: "m1", properties: { session_id: "s1" } });
    await tracker.capture({ event: "booking_cancelled", distinctId: "m1", properties: { session_id: "s1" } });
    expect(tracker.captured).toHaveLength(2);
    expect(tracker.captured[0].event).toBe("booking_created");
    expect(tracker.captured[1].event).toBe("booking_cancelled");
  });
});

describe("event builders", () => {
  it("bookingCreated sets distinctId and session_id only", () => {
    const event = bookingCreated("m1", "s1");
    expect(event.event).toBe("booking_created");
    expect(event.distinctId).toBe("m1");
    expect(event.properties).toEqual({ session_id: "s1" });
  });

  it("waitlistJoined sets distinctId and session_id only", () => {
    const event = waitlistJoined("m2", "s2");
    expect(event.event).toBe("waitlist_joined");
    expect(event.distinctId).toBe("m2");
    expect(event.properties).toEqual({ session_id: "s2" });
  });

  it("bookingCancelled sets distinctId and session_id only", () => {
    const event = bookingCancelled("m3", "s3");
    expect(event.event).toBe("booking_cancelled");
    expect(event.distinctId).toBe("m3");
    expect(event.properties).toEqual({ session_id: "s3" });
  });

  it("no event property contains email, name, or phone", () => {
    const events = [
      bookingCreated("m1", "s1"),
      waitlistJoined("m2", "s2"),
      bookingCancelled("m3", "s3"),
    ];
    const piiKeys = ["email", "name", "phone", "memberEmail", "memberName", "memberPhone"];
    for (const ev of events) {
      for (const key of Object.keys(ev.properties)) {
        expect(piiKeys).not.toContain(key);
      }
      expect(ev.distinctId).not.toContain("@");
      expect(ev.distinctId).not.toContain(".");
    }
  });
});