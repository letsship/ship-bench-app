import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { listUpcomingBookedSessions } from "./member-calendar";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const NOW_ISO = NOW.toISOString();

describe("listUpcomingBookedSessions", () => {
  it("returns only future sessions the member holds a confirmed seat in, sorted by start", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const member = seed.members[0];

    const sessions = await listUpcomingBookedSessions(repos, member.id, NOW_ISO);

    const expectedIds = seed.bookings
      .filter(
        (booking) =>
          booking.memberId === member.id &&
          booking.status === "booked" &&
          booking.cancelledAt === null,
      )
      .map((booking) => booking.sessionId)
      .filter((id) => seed.sessions.some((s) => s.id === id && s.startsAt >= NOW_ISO));
    expect(expectedIds.length).toBeGreaterThan(0);
    expect(sessions.map((s) => s.sessionId).sort()).toEqual([...expectedIds].sort());
    const starts = sessions.map((s) => s.startsAt);
    expect(starts).toEqual([...starts].sort());
  });

  it("excludes the member's past sessions even though they held a seat", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const member = seed.members[0];
    const pastBookings = seed.bookings.filter(
      (booking) =>
        booking.memberId === member.id &&
        seed.sessions.some((s) => s.id === booking.sessionId && s.startsAt < NOW_ISO),
    );
    expect(pastBookings.length).toBeGreaterThan(0);

    const sessions = await listUpcomingBookedSessions(repos, member.id, NOW_ISO);
    expect(sessions.every((s) => s.startsAt >= NOW_ISO)).toBe(true);
  });

  it("excludes waitlisted bookings — a waitlist entry never held a seat", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const member = seed.members[0];
    const futureSession = seed.sessions.find(
      (s) =>
        s.startsAt >= NOW_ISO &&
        !seed.bookings.some((b) => b.memberId === member.id && b.sessionId === s.id),
    );
    if (!futureSession) throw new Error("seed should include a future session the member skipped");
    await repos.bookings.insert({
      id: "booking-waitlisted",
      sessionId: futureSession.id,
      memberId: member.id,
      status: "waitlisted",
      bookedAt: NOW_ISO,
      cancelledAt: null,
    });

    const sessions = await listUpcomingBookedSessions(repos, member.id, NOW_ISO);
    expect(sessions.some((s) => s.sessionId === futureSession.id)).toBe(false);
  });

  it("excludes cancelled bookings", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const member = seed.members[0];
    const target = seed.bookings.find(
      (booking) =>
        booking.memberId === member.id &&
        booking.status === "booked" &&
        seed.sessions.some((s) => s.id === booking.sessionId && s.startsAt >= NOW_ISO),
    );
    if (!target) throw new Error("seed should include a future booked session");
    await repos.bookings.update(target.id, { status: "cancelled", cancelledAt: NOW_ISO });

    const sessions = await listUpcomingBookedSessions(repos, member.id, NOW_ISO);
    expect(sessions.some((s) => s.sessionId === target.sessionId)).toBe(false);
  });

  it("returns title, instructor, and time range shaped for calendar serialization", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);

    const sessions = await listUpcomingBookedSessions(repos, seed.members[0].id, NOW_ISO);

    expect(sessions.length).toBeGreaterThan(0);
    const first = sessions[0];
    expect(first.title.length).toBeGreaterThan(0);
    expect(first.instructor.length).toBeGreaterThan(0);
    expect(first.endsAt > first.startsAt).toBe(true);
  });
});
