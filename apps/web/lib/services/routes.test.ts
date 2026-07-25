import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as memberCalendarGet } from "@/app/api/ical/[token]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// Anchored to the real clock: services like buildMemberCalendarFeed use new Date()
// for filtering, so seed must be anchored to the actual current time.
const NOW = new Date();

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

  it("GET /api/ical/[token] returns 200 with text/calendar content type for valid token", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    const members = await repos.members.listByStudio((await repos.studios.getFirst())?.id ?? "");
    const member = members[0];
    const res = await memberCalendarGet(new NextRequest("http://localhost/api/ical/test"), {
      params: Promise.resolve({ token: member.calendarToken }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("END:VCALENDAR");
  });

  it("GET /api/ical/[token] includes only member's upcoming booked sessions", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    const studioId = (await repos.studios.getFirst())?.id ?? "";
    const members = await repos.members.listByStudio(studioId);
    const member = members[0];

    // Get the calendar feed for the member
    const res = await memberCalendarGet(new NextRequest("http://localhost/api/ical/test"), {
      params: Promise.resolve({ token: member.calendarToken }),
    });
    const body = await res.text();

    // Extract all UIDs from the calendar (UID:session-id@studiobook format)
    const uids = new Set<string>();
    const uidMatches = body.matchAll(/UID:([^\r\n]+)/g);
    for (const match of uidMatches) {
      uids.add(match[1]);
    }

    // Get all sessions and bookings to identify test cases
    const allSessions = await repos.classSessions.listByStudio(studioId);
    const allBookings = await repos.bookings.listByMember(member.id);
    const memberBookedSessionIds = new Set(
      allBookings
        .filter((b) => ["booked", "attended", "no_show"].includes(b.status))
        .map((b) => b.sessionId),
    );

    // Identify three key sessions:
    // 1. An upcoming booked session the member is in (should be in feed)
    const upcomingBookedSession = allSessions.find(
      (s) => new Date(s.startsAt).getTime() > NOW.getTime() && memberBookedSessionIds.has(s.id),
    );

    // 2. A past session the member attended (should NOT be in feed)
    const pastSession = allSessions.find(
      (s) => new Date(s.startsAt).getTime() < NOW.getTime() && memberBookedSessionIds.has(s.id),
    );

    // 3. An upcoming session another member is booked into but this member isn't
    let otherMemberSession: (typeof allSessions)[number] | undefined;
    for (const session of allSessions) {
      if (new Date(session.startsAt).getTime() <= NOW.getTime()) continue;
      if (memberBookedSessionIds.has(session.id)) continue;
      const sessionBookings = await repos.bookings.listBySession(session.id);
      const otherIsBooked = sessionBookings.some(
        (b) => b.memberId !== member.id && ["booked", "attended", "no_show"].includes(b.status),
      );
      if (otherIsBooked) {
        otherMemberSession = session;
        break;
      }
    }

    // Assertions: verify feed contains only member's upcoming booked sessions
    if (upcomingBookedSession) {
      expect(uids.has(`${upcomingBookedSession.id}@studiobook`)).toBe(true);
    }
    if (pastSession) {
      expect(uids.has(`${pastSession.id}@studiobook`)).toBe(false);
    }
    if (otherMemberSession) {
      expect(uids.has(`${otherMemberSession.id}@studiobook`)).toBe(false);
    }

    // The calendar should contain at least the upcoming booked sessions
    expect(uids.size).toBeGreaterThan(0);
  });

  it("GET /api/ical/[token] returns 404 for unknown token", async () => {
    const res = await memberCalendarGet(new NextRequest("http://localhost/api/ical/test"), {
      params: Promise.resolve({ token: "unknown-nonexistent-token" }),
    });
    expect(res.status).toBe(404);
  });

  it("GET /api/ical/[token] returns 404 for empty token", async () => {
    const res = await memberCalendarGet(new NextRequest("http://localhost/api/ical/test"), {
      params: Promise.resolve({ token: "" }),
    });
    expect(res.status).toBe(404);
  });
});
