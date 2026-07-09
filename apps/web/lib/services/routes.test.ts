import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// GET /api/export requires a session (unlike the other GET routes above);
// `cookies()` throws outside a real request scope, so stub the session check
// rather than fabricating a signed cookie for these hermetic route tests.
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return { ...actual, requireSession: async () => ({ email: "test@example.com" }) };
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

  it("GET /api/export?type=bookings returns a bookings CSV", async () => {
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const [header] = (await res.text()).split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
  });

  it("GET /api/export?type=bookings includes a session starting exactly at `from` and `to`", async () => {
    const boundary = "2026-03-15T08:00:00.000Z";
    const res = await exportGet(
      new NextRequest(`http://localhost/api/export?type=bookings&from=${boundary}&to=${boundary}`),
    );
    expect(res.status).toBe(200);
    const [, ...rows] = (await res.text()).split("\r\n").filter(Boolean);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.startsWith(boundary)).toBe(true);
    }
  });

  it("GET /api/export?type=bookings excludes bookings outside the range", async () => {
    const res = await exportGet(
      new NextRequest(
        "http://localhost/api/export?type=bookings&from=2026-03-15T09:00:00.000Z&to=2026-03-15T11:00:00.000Z",
      ),
    );
    expect(res.status).toBe(200);
    const rows = (await res.text()).split("\r\n").filter(Boolean);
    expect(rows).toEqual(["Starts,Class,Member,Email,Status"]);
  });

  it("GET /api/export?type=bookings includes a session starting exactly at `from`/`to` when both use a `+00:00` offset", async () => {
    const boundary = encodeURIComponent("2026-03-15T08:00:00+00:00");
    const res = await exportGet(
      new NextRequest(`http://localhost/api/export?type=bookings&from=${boundary}&to=${boundary}`),
    );
    expect(res.status).toBe(200);
    const [, ...rows] = (await res.text()).split("\r\n").filter(Boolean);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.startsWith("2026-03-15T08:00:00.000Z")).toBe(true);
    }
  });

  it("GET /api/export?type=bookings excludes bookings outside the range when `to` uses a `+00:00` offset in the past", async () => {
    const res = await exportGet(
      new NextRequest(
        `http://localhost/api/export?type=bookings&to=${encodeURIComponent("2020-01-01T00:00:00+00:00")}`,
      ),
    );
    expect(res.status).toBe(200);
    const rows = (await res.text()).split("\r\n").filter(Boolean);
    expect(rows).toEqual(["Starts,Class,Member,Email,Status"]);
  });

  it("GET /api/export?type=bookings rejects an unparseable `to` with 400 instead of returning everything", async () => {
    const res = await exportGet(
      new NextRequest("http://localhost/api/export?type=bookings&to=not-a-date"),
    );
    expect(res.status).toBe(400);
  });

  it("GET /api/export rejects an unknown type with 400", async () => {
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bogus"));
    expect(res.status).toBe(400);
  });
});
