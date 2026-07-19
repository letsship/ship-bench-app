import { describe, it, expect, beforeEach } from "vitest";
import { buildSeed } from "@/lib/db/seed-data";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { getMemberCalendarByToken } from "./calendar";
import { HttpError } from "@/lib/http";

describe("getMemberCalendarByToken", () => {
  let seed: ReturnType<typeof buildSeed>;
  let now: string;

  beforeEach(() => {
    now = new Date("2026-07-19T12:00:00Z").toISOString();
    seed = buildSeed(new Date(now));
  });

  it("returns iCalendar body for a valid token", async () => {
    const repos = createInMemoryRepositories(seed);
    const member = seed.members[0];
    const body = await getMemberCalendarByToken(repos, seed.studio.id, member.calendarToken, now);

    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("END:VCALENDAR");
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain("END:VEVENT");
  });

  it("throws 404 for an unknown token", async () => {
    const repos = createInMemoryRepositories(seed);
    const unknownToken = "unknown-token-xyz";

    await expect(
      getMemberCalendarByToken(repos, seed.studio.id, unknownToken, now),
    ).rejects.toThrow(HttpError);
    try {
      await getMemberCalendarByToken(repos, seed.studio.id, unknownToken, now);
    } catch (error) {
      if (error instanceof HttpError) {
        expect(error.status).toBe(404);
      }
    }
  });

  it("throws 404 for an empty token", async () => {
    const repos = createInMemoryRepositories(seed);

    await expect(getMemberCalendarByToken(repos, seed.studio.id, "", now)).rejects.toThrow(
      HttpError,
    );
    try {
      await getMemberCalendarByToken(repos, seed.studio.id, "", now);
    } catch (error) {
      if (error instanceof HttpError) {
        expect(error.status).toBe(404);
      }
    }
  });

  it("throws 404 for a blank-whitespace token", async () => {
    const repos = createInMemoryRepositories(seed);

    await expect(getMemberCalendarByToken(repos, seed.studio.id, "   ", now)).rejects.toThrow(
      HttpError,
    );
    try {
      await getMemberCalendarByToken(repos, seed.studio.id, "   ", now);
    } catch (error) {
      if (error instanceof HttpError) {
        expect(error.status).toBe(404);
      }
    }
  });

  it("includes only the token holder's upcoming booked sessions", async () => {
    const repos = createInMemoryRepositories(seed);
    const member = seed.members[0];
    const body = await getMemberCalendarByToken(repos, seed.studio.id, member.calendarToken, now);

    // Get the member's upcoming booked bookings
    const upcomingBookedBookings = seed.bookings.filter(
      (b) =>
        b.memberId === member.id &&
        b.status === "booked" &&
        new Date(seed.sessions.find((s) => s.id === b.sessionId)?.startsAt || "").getTime() >
          new Date(now).getTime(),
    );

    // Each booking should appear as a session UID in the calendar
    for (const booking of upcomingBookedBookings) {
      expect(body).toContain(`UID:${booking.sessionId}@studiobook`);
    }
  });

  it("calendar name includes member name", async () => {
    const repos = createInMemoryRepositories(seed);
    const member = seed.members[0];
    const body = await getMemberCalendarByToken(repos, seed.studio.id, member.calendarToken, now);

    // The calendar should have a CALNAME with the member's name
    expect(body).toContain(`X-WR-CALNAME:`);
    expect(body).toContain(member.name);
  });

  it("throws 404 when token belongs to different studio", async () => {
    const repos = createInMemoryRepositories(seed);
    const member = seed.members[0];
    const differentStudioId = "different-studio-id";

    await expect(
      getMemberCalendarByToken(repos, differentStudioId, member.calendarToken, now),
    ).rejects.toThrow(HttpError);
    try {
      await getMemberCalendarByToken(repos, differentStudioId, member.calendarToken, now);
    } catch (error) {
      if (error instanceof HttpError) {
        expect(error.status).toBe(404);
      }
    }
  });
});
