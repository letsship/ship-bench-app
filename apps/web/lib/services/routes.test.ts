import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as icalTokenGet } from "@/app/api/ical/[token]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// Use a future date so seed sessions (±8 days from NOW) are in the future when route uses new Date()
const NOW = new Date("2026-08-05T12:00:00.000Z");

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("GET /api/classes returns sessions with occupancy", async () => {
    const res = await classesGet(new NextRequest("http://localhost/api/classes"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty("occupancy");
  });

  it("GET /api/classes honours a from filter", async () => {
    const res = await classesGet(
      new NextRequest("http://localhost/api/classes?from=2099-01-01T00:00:00.000Z"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("GET /api/invoices returns invoices with a number", async () => {
    const res = await invoicesGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body[0]).toHaveProperty("number");
  });

  it("GET /api/members returns the studio's members", async () => {
    const res = await membersGet();
    expect(res.status).toBe(200);
    expect(((await res.json()) as unknown[]).length).toBeGreaterThan(0);
  });

  it("GET /api/ical/[token] with valid token returns 200 with text/calendar", async () => {
    const seed = buildSeed(NOW);
    const token = seed.members[0].calendarToken;
    const res = await icalTokenGet(new NextRequest("http://localhost/api/ical"), {
      params: Promise.resolve({ token }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
  });

  it("GET /api/ical/[token] returns only the member's booked future sessions", async () => {
    const seed = buildSeed(NOW);
    const member0 = seed.members[0];
    const member1 = seed.members[1];

    // Identify which sessions member0 and member1 are booked into
    const member0SessionIds = new Set(
      seed.bookings
        .filter((b) => b.memberId === member0.id && b.status === "booked")
        .map((b) => b.sessionId),
    );
    const member1SessionIds = new Set(
      seed.bookings
        .filter((b) => b.memberId === member1.id && b.status === "booked")
        .map((b) => b.sessionId),
    );

    // Find session details for member0
    const member0Sessions = seed.sessions.filter(
      (s) => member0SessionIds.has(s.id) && new Date(s.startsAt).getTime() > NOW.getTime(),
    );
    const member1Sessions = seed.sessions.filter(
      (s) => member1SessionIds.has(s.id) && new Date(s.startsAt).getTime() > NOW.getTime(),
    );

    // Fetch member0's calendar
    const res = await icalTokenGet(new NextRequest("http://localhost/api/ical"), {
      params: Promise.resolve({ token: member0.calendarToken }),
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("END:VCALENDAR");

    // Verify member0's sessions are included
    member0Sessions.forEach((session) => {
      const classType = seed.classTypes.find((ct) => ct.id === session.classTypeId);
      if (classType) {
        expect(body).toContain(classType.name);
      }
    });

    // Verify member1's sessions are NOT included (isolation)
    member1Sessions.forEach((session) => {
      const classType = seed.classTypes.find((ct) => ct.id === session.classTypeId);
      if (classType) {
        // member1's sessions should not appear in member0's feed
        const member1OnlySessionCount = seed.bookings.filter(
          (b) => b.sessionId === session.id && b.memberId === member1.id,
        ).length;
        const member0OnlySessionCount = seed.bookings.filter(
          (b) => b.sessionId === session.id && b.memberId === member0.id,
        ).length;
        if (member1OnlySessionCount > 0 && member0OnlySessionCount === 0) {
          // This is a session only member1 is in; verify it's not in member0's feed
          expect(body).not.toContain(session.id);
        }
      }
    });
  });

  it("GET /api/ical/[token] only includes future sessions", async () => {
    const seed = buildSeed(NOW);
    const member = seed.members[0];

    // Identify past booked sessions for this member
    const pastBookedSessions = seed.bookings.filter(
      (b) =>
        b.memberId === member.id &&
        b.status === "booked" &&
        new Date(seed.sessions.find((s) => s.id === b.sessionId)!.startsAt).getTime() <=
          NOW.getTime(),
    );

    const res = await icalTokenGet(new NextRequest("http://localhost/api/ical"), {
      params: Promise.resolve({ token: member.calendarToken }),
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("END:VCALENDAR");

    // Verify past sessions are NOT included
    pastBookedSessions.forEach((booking) => {
      // Past bookings should not appear (even if they were booked status)
      expect(body).not.toContain(booking.sessionId);
    });
  });

  it("GET /api/ical/[token] with unknown token returns 404", async () => {
    const res = await icalTokenGet(new NextRequest("http://localhost/api/ical"), {
      params: Promise.resolve({ token: "unknown_token_that_does_not_exist" }),
    });
    expect(res.status).toBe(404);
  });

  it("GET /api/ical/[token] with empty token returns 404", async () => {
    const res = await icalTokenGet(new NextRequest("http://localhost/api/ical"), {
      params: Promise.resolve({ token: "" }),
    });
    expect(res.status).toBe(404);
  });
});
