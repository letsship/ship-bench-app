import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, Member, Studio } from "@/lib/db/types";
import { buildSeed } from "@/lib/db/seed-data";
import { getMemberCalendar } from "./member-calendar";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("getMemberCalendar", () => {
  let repos: Repositories;
  let studio: Studio;
  let members: Member[];
  let sessions: ClassSession[];
  let bookings: Booking[];

  beforeEach(() => {
    const seed = buildSeed(NOW);
    repos = createInMemoryRepositories(seed);
    studio = seed.studio;
    members = seed.members;
    sessions = seed.sessions;
    bookings = seed.bookings;
  });

  const upcomingBookedSessionIds = (member: Member): Set<string> => {
    const future = new Set(
      sessions.filter((s) => new Date(s.startsAt) >= NOW).map((session) => session.id),
    );
    return new Set(
      bookings
        .filter((b) => b.memberId === member.id && b.status === "booked" && future.has(b.sessionId))
        .map((booking) => booking.sessionId),
    );
  };

  it("returns exactly the token-holder's upcoming booked sessions", async () => {
    const member = members[0];
    const { events } = await getMemberCalendar(repos, studio, member.calendarToken, NOW);

    const expected = upcomingBookedSessionIds(member);
    expect(expected.size).toBeGreaterThan(0);
    expect(new Set(events.map((event) => event.uid))).toEqual(
      new Set([...expected].map((id) => `${id}@member.studiobook`)),
    );
    expect(events.every((event) => new Date(event.startsAt) >= NOW)).toBe(true);
  });

  it("excludes another member's sessions", async () => {
    const [alice, bob] = members;
    const bobOnly = [...upcomingBookedSessionIds(bob)].filter(
      (id) => !upcomingBookedSessionIds(alice).has(id),
    );
    expect(bobOnly.length).toBeGreaterThan(0);

    const { events } = await getMemberCalendar(repos, studio, alice.calendarToken, NOW);
    const sessionIds = events.map((event) => event.uid.split("@")[0]);
    for (const sessionId of bobOnly) {
      expect(sessionIds).not.toContain(sessionId);
    }
  });

  it("excludes the member's past sessions", async () => {
    const member = members[0];
    const past = new Set(
      sessions.filter((s) => new Date(s.startsAt) < NOW).map((session) => session.id),
    );
    const pastBooked = bookings.filter((b) => b.memberId === member.id && past.has(b.sessionId));
    expect(pastBooked.length).toBeGreaterThan(0);

    const { events } = await getMemberCalendar(repos, studio, member.calendarToken, NOW);
    const sessionIds = events.map((event) => event.uid.split("@")[0]);
    for (const booking of pastBooked) {
      expect(sessionIds).not.toContain(booking.sessionId);
    }
  });

  it("excludes waitlisted and cancelled seats — only a confirmed booking counts", async () => {
    const member = members[0];
    const mine = upcomingBookedSessionIds(member);

    // A future session this member holds no seat in at all — waitlist them onto it.
    const waitlisted = sessions.find(
      (session) =>
        new Date(session.startsAt) >= NOW &&
        !bookings.some((b) => b.sessionId === session.id && b.memberId === member.id),
    );
    if (!waitlisted) throw new Error("seed has no free future session for this member");
    await repos.bookings.insert({
      id: "booking-waitlisted",
      sessionId: waitlisted.id,
      memberId: member.id,
      status: "waitlisted",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });

    // …and cancel one of the confirmed seats they do hold.
    const [confirmedSessionId] = [...mine];
    const confirmed = bookings.find(
      (b) => b.memberId === member.id && b.sessionId === confirmedSessionId,
    );
    if (!confirmed) throw new Error("member has no confirmed booking");
    await repos.bookings.update(confirmed.id, {
      status: "cancelled",
      cancelledAt: NOW.toISOString(),
    });

    const { events } = await getMemberCalendar(repos, studio, member.calendarToken, NOW);
    const sessionIds = events.map((event) => event.uid.split("@")[0]);
    expect(sessionIds).not.toContain(waitlisted.id);
    expect(sessionIds).not.toContain(confirmedSessionId);
    expect(sessionIds).toHaveLength(mine.size - 1);
  });

  it("carries the class type name, instructor and studio onto each event", async () => {
    const member = members[0];
    const { events } = await getMemberCalendar(repos, studio, member.calendarToken, NOW);
    const event = events[0];
    expect(event.title).toBeTruthy();
    expect(event.description).toMatch(/^Instructor: /);
    expect(event.location).toBe(studio.name);
  });

  it("404s for an unknown token", async () => {
    await expect(getMemberCalendar(repos, studio, "not-a-real-token", NOW)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("404s for an empty or whitespace token", async () => {
    await expect(getMemberCalendar(repos, studio, "", NOW)).rejects.toMatchObject({ status: 404 });
    await expect(getMemberCalendar(repos, studio, "   ", NOW)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("404s when the token belongs to another studio's member", async () => {
    const other: Studio = { ...studio, id: "other-studio" };
    await expect(
      getMemberCalendar(repos, other, members[0].calendarToken, NOW),
    ).rejects.toMatchObject({ status: 404 });
  });
});
