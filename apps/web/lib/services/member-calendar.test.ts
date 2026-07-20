import { describe, it, expect } from "vitest";
import { buildMemberCalendar } from "./member-calendar";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

describe("buildMemberCalendar", () => {
  const NOW = new Date("2026-07-20T12:00:00Z");

  it("returns only the member's upcoming booked sessions", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);

    const member = seed.members[0];
    const { events } = await buildMemberCalendar(repos, member.calendarToken);

    expect(events.length).toBeGreaterThan(0);
    const eventSessionIds = new Set(events.map((e) => e.uid.split("@")[0]));

    const memberBookings = seed.bookings.filter(
      (b) => b.memberId === member.id && b.status === "booked",
    );
    const bookedSessionIds = new Set(memberBookings.map((b) => b.sessionId));

    expect(eventSessionIds).toEqual(bookedSessionIds);
  });

  it("excludes past sessions", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);

    const member = seed.members[0];
    const { events } = await buildMemberCalendar(repos, member.calendarToken);

    for (const event of events) {
      const startTime = new Date(event.startsAt).getTime();
      expect(startTime).toBeGreaterThanOrEqual(NOW.getTime());
    }
  });

  it("excludes waitlisted and cancelled bookings", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);

    const member = seed.members[0];
    const { events } = await buildMemberCalendar(repos, member.calendarToken);

    const memberBookings = seed.bookings.filter((b) => b.memberId === member.id);
    const eventSessionIds = new Set(events.map((e) => e.uid.split("@")[0]));

    for (const booking of memberBookings) {
      if (booking.status !== "booked") {
        expect(eventSessionIds.has(booking.sessionId)).toBe(false);
      }
    }
  });

  it("throws 404 for unknown token", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);

    await expect(() => buildMemberCalendar(repos, "unknown-token")).rejects.toThrow(
      expect.objectContaining({
        status: 404,
        code: "not_found",
      }) as unknown,
    );
  });

  it("throws 404 for empty token", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);

    await expect(() => buildMemberCalendar(repos, "")).rejects.toThrow(
      expect.objectContaining({
        status: 404,
        code: "not_found",
      }) as unknown,
    );
  });

  it("includes member name in calendar name", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);

    const member = seed.members[0];
    const { calendarName } = await buildMemberCalendar(repos, member.calendarToken);

    expect(calendarName).toContain(member.name);
  });
});
