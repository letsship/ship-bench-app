import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { CalendarEvent } from "@/lib/domain/ical";
import { memberCalendarEvents } from "./member-calendar";
import { type StudioContext, getStudioContext } from "./studio";

// Fixed clock: the seed lays sessions a week either side of `now`, so this
// anchors which of them count as "upcoming" for both the fixture and the call.
const NOW = new Date("2026-03-15T12:00:00.000Z");
const NOW_ISO = NOW.toISOString();

const sessionIdsOf = (events: CalendarEvent[]): string[] =>
  events.map((event) => event.uid.replace("@studiobook", ""));

describe("memberCalendarEvents", () => {
  let seed: SeedData;
  let repos: Repositories;
  let ctx: StudioContext;

  beforeEach(async () => {
    seed = buildSeed(NOW);
    repos = createInMemoryRepositories(seed);
    ctx = await getStudioContext(repos);
  });

  const eventsFor = (token: string): Promise<CalendarEvent[]> =>
    memberCalendarEvents(repos, ctx, token, NOW);

  const bookedSessionIds = (memberId: string): Set<string> => {
    const upcoming = new Set(
      seed.sessions.filter((session) => session.startsAt >= NOW_ISO).map((session) => session.id),
    );
    return new Set(
      seed.bookings
        .filter(
          (booking) =>
            booking.memberId === memberId &&
            booking.status === "booked" &&
            upcoming.has(booking.sessionId),
        )
        .map((booking) => booking.sessionId),
    );
  };

  it("returns exactly the token-holder's upcoming booked sessions", async () => {
    const member = seed.members[0];
    const events = await eventsFor(member.calendarToken);
    expect(events.length).toBeGreaterThan(0);
    expect(new Set(sessionIdsOf(events))).toEqual(bookedSessionIds(member.id));
  });

  it("describes each event with the class, instructor and studio", async () => {
    const [event] = await eventsFor(seed.members[0].calendarToken);
    const session = seed.sessions.find((row) => event.uid.startsWith(row.id));
    const classType = seed.classTypes.find((row) => row.id === session?.classTypeId);
    expect(event.title).toBe(classType?.name);
    expect(event.description).toBe(`Instructor: ${session?.instructor}`);
    expect(event.location).toBe(ctx.studio.name);
  });

  it("excludes the member's past sessions", async () => {
    const member = seed.members[0];
    // The fixture must actually contain past bookings, or this proves nothing.
    const pastSessions = new Set(
      seed.sessions.filter((session) => session.startsAt < NOW_ISO).map((session) => session.id),
    );
    const pastBookings = seed.bookings.filter(
      (booking) => booking.memberId === member.id && pastSessions.has(booking.sessionId),
    );
    expect(pastBookings.length).toBeGreaterThan(0);

    const events = await eventsFor(member.calendarToken);
    expect(events.every((event) => event.startsAt >= NOW_ISO)).toBe(true);
    expect(sessionIdsOf(events).some((id) => pastSessions.has(id))).toBe(false);
  });

  it("does not leak another member's sessions", async () => {
    const [first, second] = seed.members;
    const firstIds = new Set(sessionIdsOf(await eventsFor(first.calendarToken)));
    const secondOnly = sessionIdsOf(await eventsFor(second.calendarToken)).filter(
      (id) =>
        !seed.bookings.some(
          (booking) =>
            booking.memberId === first.id &&
            booking.sessionId === id &&
            booking.status === "booked",
        ),
    );
    expect(secondOnly.length).toBeGreaterThan(0);
    expect(secondOnly.some((id) => firstIds.has(id))).toBe(false);
  });

  it("excludes a waitlisted seat — only a confirmed booking is a calendar event", async () => {
    const member = seed.members[0];
    const booked = sessionIdsOf(await eventsFor(member.calendarToken));
    const free = seed.sessions.find(
      (session) => session.startsAt >= NOW_ISO && !booked.includes(session.id),
    );
    if (!free) throw new Error("fixture must contain an unbooked upcoming session");

    await repos.bookings.insert({
      id: "booking_waitlisted",
      sessionId: free.id,
      memberId: member.id,
      status: "waitlisted",
      bookedAt: NOW_ISO,
      cancelledAt: null,
    });

    expect(sessionIdsOf(await eventsFor(member.calendarToken))).not.toContain(free.id);
  });

  it("drops a session once the booking is cancelled", async () => {
    const member = seed.members[0];
    const before = sessionIdsOf(await eventsFor(member.calendarToken));
    const booking = seed.bookings.find(
      (row) => row.memberId === member.id && before.includes(row.sessionId),
    );
    if (!booking) throw new Error("fixture must contain an upcoming booking");

    await repos.bookings.update(booking.id, { status: "cancelled" });

    const after = sessionIdsOf(await eventsFor(member.calendarToken));
    expect(after).not.toContain(booking.sessionId);
    expect(after).toHaveLength(before.length - 1);
  });

  it("404s an unknown token rather than leaking a schedule", async () => {
    await expect(eventsFor("not-a-real-token")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });

  it("404s an empty or blank token", async () => {
    await expect(eventsFor("")).rejects.toMatchObject({ status: 404 });
    await expect(eventsFor("   ")).rejects.toMatchObject({ status: 404 });
  });
});
