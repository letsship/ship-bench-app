import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-07-19T12:00:00.000Z");

describe("GET /api/ical/[token] — member calendar feed", () => {
  let seed = buildSeed(NOW);

  beforeEach(() => {
    seed = buildSeed(NOW);
    __setTestRepositories(createInMemoryRepositories(seed));
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns 200 with text/calendar for a valid token", async () => {
    const token = seed.members[0].calendarToken;
    const res = await GET(new Request("http://localhost/api/ical/" + token), {
      params: Promise.resolve({ token }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
  });

  it("returns iCalendar events for the member's booked sessions", async () => {
    const member = seed.members[0];
    const token = member.calendarToken;

    // Find bookings for this member.
    const memberBookings = seed.bookings.filter((b) => b.memberId === member.id);
    const futureBookedSessionIds = memberBookings
      .filter((b) => {
        const session = seed.sessions.find((s) => s.id === b.sessionId);
        return session && new Date(session.startsAt) > NOW && b.status === "booked";
      })
      .map((b) => b.sessionId);

    const res = await GET(new Request("http://localhost/api/ical/" + token), {
      params: Promise.resolve({ token }),
    });

    expect(res.status).toBe(200);
    const body = await res.text();

    // Check that the response contains at least one event and includes the member's session UIDs.
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("END:VCALENDAR");

    for (const sessionId of futureBookedSessionIds) {
      expect(body).toContain(`UID:${sessionId}@studiobook`);
    }
  });

  it("excludes past sessions from the feed", async () => {
    const member = seed.members[0];
    const token = member.calendarToken;

    // Find any past sessions the member booked.
    const pastBookings = seed.bookings.filter((b) => {
      const session = seed.sessions.find((s) => s.id === b.sessionId);
      return session && new Date(session.startsAt) < NOW && b.memberId === member.id;
    });

    const res = await GET(new Request("http://localhost/api/ical/" + token), {
      params: Promise.resolve({ token }),
    });

    expect(res.status).toBe(200);
    const body = await res.text();

    // Ensure past sessions are not in the feed.
    for (const booking of pastBookings) {
      expect(body).not.toContain(`UID:${booking.sessionId}@studiobook`);
    }
  });

  it("excludes other members' sessions from the feed", async () => {
    const member1 = seed.members[0];
    const member2 = seed.members[1];
    const token = member1.calendarToken;

    // Find sessions booked by member2 but not member1.
    const member2OnlySessionIds = seed.bookings
      .filter((b) => b.memberId === member2.id && b.status === "booked")
      .filter(
        (b) =>
          !seed.bookings.some(
            (b2) =>
              b2.sessionId === b.sessionId && b2.memberId === member1.id && b2.status === "booked",
          ),
      )
      .map((b) => b.sessionId);

    const res = await GET(new Request("http://localhost/api/ical/" + token), {
      params: Promise.resolve({ token }),
    });

    expect(res.status).toBe(200);
    const body = await res.text();

    // Ensure member2's exclusive sessions are not in member1's feed.
    for (const sessionId of member2OnlySessionIds) {
      expect(body).not.toContain(`UID:${sessionId}@studiobook`);
    }
  });

  it("returns 404 for an unknown token", async () => {
    const res = await GET(new Request("http://localhost/api/ical/unknown_token"), {
      params: Promise.resolve({ token: "unknown_token" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for an empty token", async () => {
    const res = await GET(new Request("http://localhost/api/ical/"), {
      params: Promise.resolve({ token: "" }),
    });
    expect(res.status).toBe(404);
  });

  it("does not require a session cookie", async () => {
    const token = seed.members[0].calendarToken;
    // Explicitly create a request without any cookies.
    const req = new Request("http://localhost/api/ical/" + token, {
      headers: new Headers(),
    });
    expect(req.headers.get("cookie")).toBeNull();

    const res = await GET(req, { params: Promise.resolve({ token }) });
    expect(res.status).toBe(200);
  });

  it("includes waitlisted or cancelled bookings as not seat-taking", async () => {
    const seed2 = buildSeed(NOW);

    // Manually create a session and a waitlisted booking for a member.
    const session = seed2.sessions[0];
    const member = seed2.members[0];

    // Add a waitlisted booking for this session to this member.
    seed2.bookings.push({
      id: "waitlist-booking",
      sessionId: session.id,
      memberId: member.id,
      status: "waitlisted",
      bookedAt: new Date().toISOString(),
      cancelledAt: null,
    });

    __setTestRepositories(createInMemoryRepositories(seed2));

    const token = member.calendarToken;
    const res = await GET(new Request("http://localhost/api/ical/" + token), {
      params: Promise.resolve({ token }),
    });

    expect(res.status).toBe(200);
    const body = await res.text();

    // The waitlisted session should NOT appear in the feed.
    expect(body).not.toContain(`UID:${session.id}@studiobook`);
  });
});
