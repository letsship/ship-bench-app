import { describe, it, expect } from "vitest";
import { memberCalendarEvents } from "./member-calendar";

describe("memberCalendarEvents", () => {
  const memberId = "member-1";
  const now = "2026-07-27T12:00:00.000Z";

  it("includes only the target member's future seat-taking sessions", () => {
    const sessions = [
      {
        id: "session-1",
        classTypeId: "class-1",
        classTypeName: "Yoga",
        instructor: "Alice",
        startsAt: "2026-07-28T09:00:00.000Z",
        endsAt: "2026-07-28T10:00:00.000Z",
      },
      {
        id: "session-2",
        classTypeId: "class-1",
        classTypeName: "Yoga",
        instructor: "Bob",
        startsAt: "2026-07-29T09:00:00.000Z",
        endsAt: "2026-07-29T10:00:00.000Z",
      },
    ];
    const bookings = [
      { sessionId: "session-1", memberId, status: "booked" },
      { sessionId: "session-2", memberId, status: "attended" },
    ];

    const events = memberCalendarEvents(memberId, now, sessions, bookings);

    expect(events).toHaveLength(2);
    expect(events[0].uid).toBe("session-1@studiobook");
    expect(events[0].title).toBe("Yoga");
    expect(events[0].startsAt).toBe("2026-07-28T09:00:00.000Z");
    expect(events[1].uid).toBe("session-2@studiobook");
  });

  it("excludes the member's past sessions", () => {
    const sessions = [
      {
        id: "session-1",
        classTypeId: "class-1",
        classTypeName: "Yoga",
        instructor: "Alice",
        startsAt: "2026-07-26T09:00:00.000Z",
        endsAt: "2026-07-26T10:00:00.000Z",
      },
    ];
    const bookings = [{ sessionId: "session-1", memberId, status: "attended" }];

    const events = memberCalendarEvents(memberId, now, sessions, bookings);

    expect(events).toHaveLength(0);
  });

  it("excludes other members' sessions", () => {
    const sessions = [
      {
        id: "session-1",
        classTypeId: "class-1",
        classTypeName: "Yoga",
        instructor: "Alice",
        startsAt: "2026-07-28T09:00:00.000Z",
        endsAt: "2026-07-28T10:00:00.000Z",
      },
    ];
    const bookings = [{ sessionId: "session-1", memberId: "other-member", status: "booked" }];

    const events = memberCalendarEvents(memberId, now, sessions, bookings);

    expect(events).toHaveLength(0);
  });

  it("excludes waitlisted bookings", () => {
    const sessions = [
      {
        id: "session-1",
        classTypeId: "class-1",
        classTypeName: "Yoga",
        instructor: "Alice",
        startsAt: "2026-07-28T09:00:00.000Z",
        endsAt: "2026-07-28T10:00:00.000Z",
      },
    ];
    const bookings = [{ sessionId: "session-1", memberId, status: "waitlisted" }];

    const events = memberCalendarEvents(memberId, now, sessions, bookings);

    expect(events).toHaveLength(0);
  });

  it("excludes cancelled bookings", () => {
    const sessions = [
      {
        id: "session-1",
        classTypeId: "class-1",
        classTypeName: "Yoga",
        instructor: "Alice",
        startsAt: "2026-07-28T09:00:00.000Z",
        endsAt: "2026-07-28T10:00:00.000Z",
      },
    ];
    const bookings = [{ sessionId: "session-1", memberId, status: "cancelled" }];

    const events = memberCalendarEvents(memberId, now, sessions, bookings);

    expect(events).toHaveLength(0);
  });

  it("includes no_show status as seat-taking", () => {
    const sessions = [
      {
        id: "session-1",
        classTypeId: "class-1",
        classTypeName: "Yoga",
        instructor: "Alice",
        startsAt: "2026-07-28T09:00:00.000Z",
        endsAt: "2026-07-28T10:00:00.000Z",
      },
    ];
    const bookings = [{ sessionId: "session-1", memberId, status: "no_show" }];

    const events = memberCalendarEvents(memberId, now, sessions, bookings);

    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe("session-1@studiobook");
  });

  it("maps fields correctly to CalendarEvent", () => {
    const sessions = [
      {
        id: "sess-123",
        classTypeId: "class-xyz",
        classTypeName: "Reformer Pilates",
        instructor: "Priya",
        startsAt: "2026-08-01T14:30:00.000Z",
        endsAt: "2026-08-01T15:30:00.000Z",
      },
    ];
    const bookings = [{ sessionId: "sess-123", memberId, status: "booked" }];

    const events = memberCalendarEvents(memberId, now, sessions, bookings);

    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.uid).toBe("sess-123@studiobook");
    expect(event.title).toBe("Reformer Pilates");
    expect(event.startsAt).toBe("2026-08-01T14:30:00.000Z");
    expect(event.endsAt).toBe("2026-08-01T15:30:00.000Z");
    expect(event.description).toBe("Instructor: Priya");
  });
});
