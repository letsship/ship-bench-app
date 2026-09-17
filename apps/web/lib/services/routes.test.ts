import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// The export route gates on `requireSession()` (which reads Next request
// cookies); outside a real request scope that throws, so stub it for the
// export-route tests only. The other GET handlers under test do not call it.
vi.mock("@/lib/auth/session", async (original) => {
  const actual = await original<typeof import("@/lib/auth/session")>();
  return { ...actual, requireSession: () => Promise.resolve({ email: "owner@test" }) };
});

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

  it("GET /api/export?type=bookings returns a CSV with the right header", async () => {
    const res = await exportGet(
      new NextRequest("http://localhost/api/export?type=bookings"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("studiobook-bookings.csv");
    const body = await res.text();
    const [header, ...rows] = body.split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("GET /api/export?type=bookings narrows rows with from/to", async () => {
    const all = await exportGet(
      new NextRequest("http://localhost/api/export?type=bookings"),
    );
    const allRows = (await all.text()).split("\r\n").slice(1);
    expect(allRows.length).toBeGreaterThan(2);

    // Pick a single session start from the middle and request the inclusive
    // [from, to] window where from === to. Only bookings for that one session
    // (which may be several, incl. waitlist) should come back — strictly fewer
    // than the full set.
    const mid = allRows[Math.floor(allRows.length / 2)].split(",")[0];
    const url = `http://localhost/api/export?type=bookings&from=${encodeURIComponent(mid)}&to=${encodeURIComponent(mid)}`;
    const narrowed = await exportGet(new NextRequest(url));
    const narrowRows = (await narrowed.text()).split("\r\n").slice(1);
    expect(narrowRows.length).toBeGreaterThan(0);
    expect(narrowRows.length).toBeLessThan(allRows.length);
    for (const row of narrowRows) {
      expect(row.split(",")[0]).toBe(mid);
    }
  });

  it("GET /api/export?type=unknown still 400s", async () => {
    const res = await exportGet(
      new NextRequest("http://localhost/api/export?type=bogus"),
    );
    expect(res.status).toBe(400);
  });
});
