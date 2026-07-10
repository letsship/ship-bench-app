import { describe, expect, it } from "vitest";
import { bookingCancelledEvent, bookingCreatedEvent, waitlistJoinedEvent } from "./events";

describe("analytics event builders", () => {
  it("builds booking_created with the member as distinctId and session_id property", () => {
    const event = bookingCreatedEvent("m1", "cs1");
    expect(event).toEqual({
      distinctId: "m1",
      event: "booking_created",
      properties: { session_id: "cs1" },
    });
  });

  it("builds waitlist_joined with the member as distinctId and session_id property", () => {
    const event = waitlistJoinedEvent("m2", "cs2");
    expect(event).toEqual({
      distinctId: "m2",
      event: "waitlist_joined",
      properties: { session_id: "cs2" },
    });
  });

  it("builds booking_cancelled with the member as distinctId and session_id property", () => {
    const event = bookingCancelledEvent("m3", "cs3");
    expect(event).toEqual({
      distinctId: "m3",
      event: "booking_cancelled",
      properties: { session_id: "cs3" },
    });
  });

  it.each([
    ["booking_created", bookingCreatedEvent] as const,
    ["waitlist_joined", waitlistJoinedEvent] as const,
    ["booking_cancelled", bookingCancelledEvent] as const,
  ])("%s carries no PII — only session_id in properties", (_name, builder) => {
    const event = builder("m1", "cs1");
    expect(Object.keys(event.properties)).toEqual(["session_id"]);
    expect(event.properties).not.toHaveProperty("email");
    expect(event.properties).not.toHaveProperty("name");
    expect(event.properties).not.toHaveProperty("phone");
    expect(event).not.toHaveProperty("email");
    expect(event).not.toHaveProperty("name");
    expect(event).not.toHaveProperty("phone");
  });
});
