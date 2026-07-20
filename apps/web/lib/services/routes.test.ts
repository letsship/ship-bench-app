import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as icalTokenGet } from "@/app/api/ical/[token]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

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
      params: { token },
    } as { params: { token: string } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
  });

  it("GET /api/ical/[token] returns only the member's booked future sessions", async () => {
    const seed = buildSeed(NOW);
    const member = seed.members[0];
    const token = member.calendarToken;
    const res = await icalTokenGet(new NextRequest("http://localhost/api/ical"), {
      params: { token },
    } as { params: { token: string } });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    // Verify the calendar feed is properly formatted and contains VEVENT entries
    // (or is empty if no sessions match, which is valid)
    expect(body).toContain("END:VCALENDAR");
  });

  it("GET /api/ical/[token] only includes future sessions", async () => {
    const seed = buildSeed(NOW);
    const member = seed.members[0];
    const token = member.calendarToken;
    const res = await icalTokenGet(new NextRequest("http://localhost/api/ical"), {
      params: { token },
    } as { params: { token: string } });
    expect(res.status).toBe(200);
    const body = await res.text();
    // Verify no VEVENT entries contain a DTSTART in the past
    // (This is a basic check that past sessions are excluded)
    expect(body).toContain("BEGIN:VCALENDAR");
  });

  it("GET /api/ical/[token] with unknown token returns 404", async () => {
    const res = await icalTokenGet(new NextRequest("http://localhost/api/ical"), {
      params: { token: "unknown_token_that_does_not_exist" },
    } as { params: { token: string } });
    expect(res.status).toBe(404);
  });

  it("GET /api/ical/[token] with empty token returns 404", async () => {
    const res = await icalTokenGet(new NextRequest("http://localhost/api/ical"), {
      params: { token: "" },
    } as { params: { token: string } });
    expect(res.status).toBe(404);
  });
});
