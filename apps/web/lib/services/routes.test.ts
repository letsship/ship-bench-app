import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as memberIcalGet } from "@/app/api/ical/[token]/route";
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

  it("GET /api/members never exposes calendar tokens", async () => {
    // This endpoint takes no session, so leaking the secret here would hand out
    // every member's private feed.
    const body = (await (await membersGet()).json()) as Record<string, unknown>[];
    expect(body.every((member) => !("calendarToken" in member))).toBe(true);
  });
});

// The private per-member feed. No session cookie is set in these tests — the
// secret token in the path is the only thing authorising the request.
describe("GET /api/ical/[token] (private per-member calendar feed)", () => {
  // The route resolves "upcoming" against the real clock, so anchor the seed to
  // it rather than to the fixed NOW above — otherwise nothing is in the future.
  const seed = buildSeed(new Date());

  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(seed));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  const call = (token: string): Promise<Response> =>
    memberIcalGet(new Request(`http://localhost/api/ical/${token}`), {
      params: Promise.resolve({ token }),
    });

  it("returns an iCalendar feed for a valid token", async () => {
    const res = await call(seed.members[0].calendarToken);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/calendar/);
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("BEGIN:VEVENT");
  });

  it("404s a made-up token", async () => {
    const res = await call("made-up-token");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "not_found" } });
  });
});
