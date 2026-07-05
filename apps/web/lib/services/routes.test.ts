import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// /api/export requires a signed-in session (unlike the plain GET /api/members
// and /api/invoices handlers exercised below); the fake next/headers cookie
// store has no request scope in this unit-test environment, so stub the
// session check itself rather than fabricating a cookie jar.
vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "test@example.com" }),
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

  it("GET /api/export?type=bookings returns a CSV of all bookings when unbounded", async () => {
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const [header, ...rows] = (await res.text()).split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("GET /api/export?type=bookings honours from/to filtering", async () => {
    const unboundedRows = (
      await (await exportGet(new NextRequest("http://localhost/api/export?type=bookings"))).text()
    )
      .split("\r\n")
      .slice(1)
      .filter(Boolean);

    const res = await exportGet(
      new NextRequest(
        "http://localhost/api/export?type=bookings&from=2026-03-15T00:00:00.000Z&to=2026-03-15T23:59:59.999Z",
      ),
    );
    expect(res.status).toBe(200);
    const rows = (await res.text()).split("\r\n").slice(1).filter(Boolean);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(unboundedRows.length);
    for (const row of rows) {
      expect(row.startsWith("2026-03-15")).toBe(true);
    }
  });

  it("GET /api/export?type=bookings includes a session whose start exactly equals `to` (inclusive both ends)", async () => {
    const res = await exportGet(
      new NextRequest(
        "http://localhost/api/export?type=bookings&from=2026-03-15T12:00:00.000Z&to=2026-03-15T12:00:00.000Z",
      ),
    );
    expect(res.status).toBe(200);
    const rows = (await res.text()).split("\r\n").slice(1).filter(Boolean);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.startsWith("2026-03-15T12:00:00.000Z,")).toBe(true);
    }
  });
});
