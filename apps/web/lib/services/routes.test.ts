import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as memberCalendarGet } from "@/app/api/ical/[token]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as memberGet } from "@/app/api/members/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
    vi.useRealTimers();
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
    const members = (await res.json()) as Record<string, unknown>[];
    expect(members.length).toBeGreaterThan(0);
    expect(members[0]).not.toHaveProperty("calendarToken");
  });

  it("GET /api/members/:id does not expose the calendar token", async () => {
    const seed = buildSeed(NOW);
    const res = await memberGet(new Request("http://localhost/api/members/member"), {
      params: Promise.resolve({ id: seed.members[0].id }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).not.toHaveProperty("calendarToken");
  });

  it("GET /api/ical/:token returns only the member's upcoming booked sessions", async () => {
    const seed = buildSeed(NOW);
    const member = seed.members[0];
    const bookedSessionIds = new Set(
      seed.bookings
        .filter((booking) => booking.memberId === member.id && booking.status === "booked")
        .map((booking) => booking.sessionId),
    );
    const expectedUids = seed.sessions
      .filter((session) => session.startsAt > NOW.toISOString() && bookedSessionIds.has(session.id))
      .map((session) => `UID:${session.id}@studiobook`);

    const res = await memberCalendarGet(new Request("http://localhost/api/ical/token"), {
      params: Promise.resolve({ token: member.calendarToken }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    const body = await res.text();
    expect(body.match(/^UID:.*$/gm)?.sort()).toEqual(expectedUids.sort());
  });

  it("GET /api/ical/:token returns 404 for unknown and empty tokens", async () => {
    const unknown = await memberCalendarGet(new Request("http://localhost/api/ical/nope"), {
      params: Promise.resolve({ token: "not-a-token" }),
    });
    const empty = await memberCalendarGet(new Request("http://localhost/api/ical/"), {
      params: Promise.resolve({ token: "" }),
    });

    expect(unknown.status).toBe(404);
    expect(empty.status).toBe(404);
  });
});
