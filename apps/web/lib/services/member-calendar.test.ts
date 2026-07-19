import { describe, it, expect } from "vitest";
import { getMemberUpcomingCalendar } from "./member-calendar";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { HttpError } from "@/lib/http";

describe("getMemberUpcomingCalendar", () => {
  const NOW = new Date("2026-02-15T10:00:00Z");
  const seed = buildSeed(NOW);
  const repos = createInMemoryRepositories(seed);

  it("returns only the token holder's upcoming booked sessions", async () => {
    const member = seed.members[0];
    const { member: resolvedMember, events } = await getMemberUpcomingCalendar(
      repos,
      member.calendarToken,
      NOW,
    );

    expect(resolvedMember.id).toBe(member.id);
    expect(events.length).toBeGreaterThan(0);

    // All events should have the member's ID in the UID
    for (const event of events) {
      expect(event.uid).toContain(`-${member.id}@`);
    }
  });

  it("excludes past sessions", async () => {
    const member = seed.members[0];
    const { events } = await getMemberUpcomingCalendar(repos, member.calendarToken, NOW);

    for (const event of events) {
      const eventTime = new Date(event.startsAt).getTime();
      expect(eventTime).toBeGreaterThan(NOW.getTime());
    }
  });

  it("excludes waitlisted bookings", async () => {
    const member = seed.members[0];
    const { events } = await getMemberUpcomingCalendar(repos, member.calendarToken, NOW);
    const eventSessionIds = new Set(events.map((e) => e.uid.split("-")[0]));

    // Check that waitlisted sessions are excluded
    for (const booking of seed.bookings) {
      if (booking.memberId === member.id && booking.status === "waitlisted") {
        expect(eventSessionIds.has(booking.sessionId)).toBe(false);
      }
    }
  });

  it("throws 404 for unknown token", async () => {
    await expect(getMemberUpcomingCalendar(repos, "unknown_token_xyz", NOW)).rejects.toThrow(
      HttpError,
    );
    await expect(getMemberUpcomingCalendar(repos, "unknown_token_xyz", NOW)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("throws 404 for empty token", async () => {
    await expect(getMemberUpcomingCalendar(repos, "", NOW)).rejects.toThrow(HttpError);
    await expect(getMemberUpcomingCalendar(repos, "", NOW)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("throws 404 for whitespace-only token", async () => {
    await expect(getMemberUpcomingCalendar(repos, "   ", NOW)).rejects.toThrow(HttpError);
    await expect(getMemberUpcomingCalendar(repos, "   ", NOW)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("throws 404 for undefined token", async () => {
    await expect(getMemberUpcomingCalendar(repos, undefined, NOW)).rejects.toThrow(HttpError);
    await expect(getMemberUpcomingCalendar(repos, undefined, NOW)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("excludes cancelled sessions", async () => {
    const member = seed.members[0];

    // Mark a session as cancelled
    const session = seed.sessions[0];
    session.status = "cancelled";

    const { events } = await getMemberUpcomingCalendar(repos, member.calendarToken, NOW);
    const eventSessionIds = new Set(events.map((e) => e.uid.split("-")[0]));

    expect(eventSessionIds.has(session.id)).toBe(false);
  });

  it("includes class type name in events", async () => {
    const member = seed.members[0];
    const { events } = await getMemberUpcomingCalendar(repos, member.calendarToken, NOW);

    for (const event of events) {
      expect(event.title).toBeTruthy();
      expect(event.title).not.toBe("");
    }
  });

  it("formats event UID correctly with member ID", async () => {
    const member = seed.members[0];
    const { events } = await getMemberUpcomingCalendar(repos, member.calendarToken, NOW);

    for (const event of events) {
      expect(event.uid).toMatch(/^[a-f0-9-]+-[a-f0-9-]+@studiobook$/);
      expect(event.uid).toContain(`-${member.id}@`);
    }
  });
});
