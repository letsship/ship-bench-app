import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as icalTokenGet } from "@/app/api/ical/[token]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
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

  it("GET /api/ical/[token] returns a text/calendar feed for the token-holder's upcoming booked sessions", async () => {
    // Re-seed around the real clock so the member actually has upcoming
    // sessions relative to getMemberCalendar's default `now`.
    __setTestRepositories(createInMemoryRepositories(buildSeed()));
    // cal-tok-0001 is Amara Okafor's deterministic seed token.
    const res = await icalTokenGet(new NextRequest("http://localhost/api/ical/cal-tok-0001"), {
      params: Promise.resolve({ token: "cal-tok-0001" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("END:VCALENDAR");
    // The feed is non-empty (the seed books Amara into upcoming sessions).
    expect(body).toContain("BEGIN:VEVENT");
    // The calendar name is scoped to the member, not the whole studio.
    expect(body).toContain("Amara Okafor classes");
  });

  it("GET /api/ical/[token] 404s for an unknown token", async () => {
    const res = await icalTokenGet(new NextRequest("http://localhost/api/ical/nope"), {
      params: Promise.resolve({ token: "nope" }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");
  });

  it("GET /api/ical/[token] 404s for a whitespace token", async () => {
    const res = await icalTokenGet(new NextRequest("http://localhost/api/ical/%20%20"), {
      params: Promise.resolve({ token: "  " }),
    });
    expect(res.status).toBe(404);
  });
});
