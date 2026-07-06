import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// The export GET (unlike the list GETs) calls requireSession(), which reads
// next/headers cookies() — outside a real Next request scope in vitest, that
// throws. Stub the session guard so the export handler can run end-to-end
// against the injected fake repositories. The session requirement itself
// lives in the route (unchanged); these tests cover the CSV it emits.
vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "bookkeeper@example.com" }),
  SESSION_COOKIE: "sb-session",
}));

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

  it("GET /api/export?type=bookings returns a CSV with the Starts,Class,Member,Email,Status header", async () => {
    const res = await exportGet(
      new NextRequest("http://localhost/api/export?type=bookings"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const body = await res.text();
    expect(body.split("\r\n")[0]).toBe("Starts,Class,Member,Email,Status");
    expect(body.split("\r\n").length).toBeGreaterThan(1);
  });

  it("GET /api/export?type=bookings honours an inclusive from/to range", async () => {
    const seed = buildSeed(NOW);
    // Pick the first session's start as `from` and last as `to` so both bounds
    // are inclusive and at least one row survives on each end.
    const starts = seed.sessions.map((s) => s.startsAt).sort();
    const from = starts[0];
    const to = starts[starts.length - 1];
    __setTestRepositories(createInMemoryRepositories(seed));
    const res = await exportGet(
      new NextRequest(`http://localhost/api/export?type=bookings&from=${from}&to=${to}`),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    const rows = body.split("\r\n").slice(1).filter((line) => line.length > 0);
    expect(rows.length).toBeGreaterThan(0);
    // Every row's Starts column sits within [from, to].
    for (const line of rows) {
      const startsAt = line.split(",")[0];
      expect(startsAt >= from).toBe(true);
      expect(startsAt <= to).toBe(true);
    }
  });

  it("GET /api/export?type=bookings quotes a member name containing a comma", async () => {
    // Seed a member whose stored name has a comma so the response body keeps
    // it as a single quoted CSV column.
    const seed = buildSeed(NOW);
    seed.members[0] = { ...seed.members[0], name: "Rossi, Chiara" };
    __setTestRepositories(createInMemoryRepositories(seed));
    const res = await exportGet(
      new NextRequest("http://localhost/api/export?type=bookings"),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('"Rossi, Chiara"');
  });
});
