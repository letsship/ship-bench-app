import { describe, expect, it, afterEach } from "vitest";
import { __setTestTracker, resolveTracker } from "./index";
import { createFakeTracker } from "./fake-tracker";
import * as analyticsEvents from "./events";

describe("Analytics tracker seam and event builders", () => {
  afterEach(() => {
    __setTestTracker(null);
  });

  it("__setTestTracker overrides resolveTracker", async () => {
    const fakeTracker = createFakeTracker();
    __setTestTracker(fakeTracker);
    const resolved = await resolveTracker();
    expect(resolved).toBe(fakeTracker);
  });

  it("fake tracker records captures", async () => {
    const fakeTracker = createFakeTracker();
    __setTestTracker(fakeTracker);
    const tracker = await resolveTracker();

    await tracker.capture({
      event: "test_event",
      distinctId: "member_123",
      properties: { foo: "bar" },
    });

    expect(fakeTracker.captured).toHaveLength(1);
    expect(fakeTracker.captured[0]).toEqual({
      event: "test_event",
      distinctId: "member_123",
      properties: { foo: "bar" },
    });
  });

  describe("Event builders", () => {
    it("bookingCreated builder produces correct event", () => {
      const event = analyticsEvents.bookingCreated({
        memberId: "member_123",
        sessionId: "session_456",
      });

      expect(event.event).toBe("booking_created");
      expect(event.distinctId).toBe("member_123");
      expect(event.properties).toEqual({ session_id: "session_456" });
    });

    it("waitlistJoined builder produces correct event", () => {
      const event = analyticsEvents.waitlistJoined({
        memberId: "member_123",
        sessionId: "session_456",
      });

      expect(event.event).toBe("waitlist_joined");
      expect(event.distinctId).toBe("member_123");
      expect(event.properties).toEqual({ session_id: "session_456" });
    });

    it("bookingCancelled builder produces correct event", () => {
      const event = analyticsEvents.bookingCancelled({
        memberId: "member_123",
        sessionId: "session_456",
      });

      expect(event.event).toBe("booking_cancelled");
      expect(event.distinctId).toBe("member_123");
      expect(event.properties).toEqual({ session_id: "session_456" });
    });

    it("event builders never include email, name, or phone in properties", () => {
      const bookingEvent = analyticsEvents.bookingCreated({
        memberId: "member_123",
        sessionId: "session_456",
      });

      const waitlistEvent = analyticsEvents.waitlistJoined({
        memberId: "member_123",
        sessionId: "session_456",
      });

      const cancelEvent = analyticsEvents.bookingCancelled({
        memberId: "member_123",
        sessionId: "session_456",
      });

      const allEvents = [bookingEvent, waitlistEvent, cancelEvent];

      for (const event of allEvents) {
        const props = event.properties || {};
        expect(props).not.toHaveProperty("email");
        expect(props).not.toHaveProperty("name");
        expect(props).not.toHaveProperty("phone");
        expect(Object.keys(props).join(",")).not.toMatch(/email|name|phone/i);
      }
    });
  });
});
