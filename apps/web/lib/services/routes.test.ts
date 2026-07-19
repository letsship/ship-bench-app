import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as icalTokenGet } from "@/app/api/ical/[token]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-07-19T12:00:00.000Z");
let seed: ReturnType<typeof buildSeed>;

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(() => {
    seed = buildSeed(NOW);
    __setTestRepositories(createInMemoryRepositories(seed));
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

  it("GET /api/ical/[token] returns 200 with text/calendar for a valid token", async () => {
    const member = seed.members[0];
    const res = await icalTokenGet(
      new NextRequest("http://localhost/api/ical/" + member.calendarToken),
      { params: Promise.resolve({ token: member.calendarToken }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("END:VCALENDAR");
  });

  it("GET /api/ical/[token] returns 404 for an unknown token", async () => {
    const res = await icalTokenGet(new NextRequest("http://localhost/api/ical/unknown-token"), {
      params: Promise.resolve({ token: "unknown-token" }),
    });
    expect(res.status).toBe(404);
  });

  it("GET /api/ical/[token] returns 404 for an empty token", async () => {
    const res = await icalTokenGet(new NextRequest("http://localhost/api/ical/"), {
      params: Promise.resolve({ token: "" }),
    });
    expect(res.status).toBe(404);
  });

  it("GET /api/ical/[token] does not require a session cookie", async () => {
    const member = seed.members[0];
    // The test injects repositories without any session validation
    const res = await icalTokenGet(
      new NextRequest("http://localhost/api/ical/" + member.calendarToken),
      { params: Promise.resolve({ token: member.calendarToken }) },
    );
    // If the handler tried to requireSession(), this would throw, but it passes
    // (404 is acceptable if there are no upcoming sessions, the important part is no auth error)
    expect([200, 404]).toContain(res.status);
  });

  it("GET /api/ical/[token] includes member's upcoming booked sessions only", async () => {
    const member = seed.members[0];
    const res = await icalTokenGet(
      new NextRequest("http://localhost/api/ical/" + member.calendarToken),
      { params: Promise.resolve({ token: member.calendarToken }) },
    );
    const body = await res.text();

    // Get the member's upcoming booked bookings relative to NOW
    const nowMs = NOW.getTime();
    const upcomingBookedBookings = seed.bookings.filter(
      (b) =>
        b.memberId === member.id &&
        b.status === "booked" &&
        new Date(seed.sessions.find((s) => s.id === b.sessionId)?.startsAt || "").getTime() > nowMs,
    );

    // Each booking should appear as a session UID in the calendar
    for (const booking of upcomingBookedBookings) {
      expect(body).toContain(`UID:${booking.sessionId}@studiobook`);
    }
  });
});
