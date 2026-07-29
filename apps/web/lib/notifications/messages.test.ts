import { describe, expect, it } from "vitest";
import { bookingReminder } from "./messages";

describe("bookingReminder", () => {
  const recipient = { memberId: "m1", email: "m1@e.co", name: "Amara" };
  const session = {
    title: "Vinyasa Flow",
    startsAt: "2026-03-16T08:00:00.000Z",
    instructor: "Noor",
  };

  it("builds a booking_reminder message carrying the booking id", () => {
    const message = bookingReminder(recipient, session, "b1");
    expect(message.kind).toBe("booking_reminder");
    expect(message.recipient).toBe(recipient);
    expect(message.subject).toContain("Vinyasa Flow");
    expect(message.body).toContain("Vinyasa Flow");
    expect(message.body).toContain("Amara");
    expect(message.data).toMatchObject({
      title: "Vinyasa Flow",
      startsAt: session.startsAt,
      bookingId: "b1",
    });
  });
});
