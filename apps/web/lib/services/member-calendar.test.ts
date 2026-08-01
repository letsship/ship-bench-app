import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { getMemberCalendar } from "./member-calendar";

const NOW = new Date("2026-07-01T12:00:00.000Z");

describe("getMemberCalendar", () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW }));
  afterEach(() => vi.useRealTimers());

  it("returns only the member's upcoming seat-taking sessions", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const member = seed.members[0];
    const events = await getMemberCalendar(repos, seed.studio, member.calendarToken);
    const memberBookings = seed.bookings.filter((booking) => booking.memberId === member.id);

    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => new Date(event.startsAt) >= NOW)).toBe(true);
    expect(events.every((event) => memberBookings.some((booking) =>
      booking.sessionId === event.uid.replace("@studiobook", "") &&
      ["booked", "attended", "no_show"].includes(booking.status),
    ))).toBe(true);
    expect(events.some((event) =>
      seed.bookings.some((booking) => booking.sessionId === event.uid.replace("@studiobook", "") && booking.memberId !== member.id),
    )).toBe(true);
    expect(events.every((event) => !event.title.includes("waitlisted"))).toBe(true);
  });

  it("404s for an unknown token", async () => {
    const seed = buildSeed(NOW);
    await expect(
      getMemberCalendar(createInMemoryRepositories(seed), seed.studio, "unknown-token"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("404s for an empty token", async () => {
    const seed = buildSeed(NOW);
    await expect(getMemberCalendar(createInMemoryRepositories(seed), seed.studio, "  ")).rejects.toMatchObject({
      status: 404,
    });
  });
});
