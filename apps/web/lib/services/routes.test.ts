import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// GET /api/export requires a signed-in session (via next/headers cookies()),
// which has no request scope when a route handler is invoked directly in
// tests. Stub it the same way for every export test rather than plumbing a
// real cookie through NextRequest.
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return { ...actual, requireSession: vi.fn().mockResolvedValue({ email: "founder@example.com" }) };
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
    const body = await res.text();
    expect(body.split("\r\n")[0]).toBe("Starts,Class,Member,Email,Status");
  });

  it("GET /api/export?type=bookings filters inclusively, keeping a booking exactly on `to`", async () => {
    // A seeded session starts exactly at NOW (dayOffset 0, hour 12).
    const boundary = NOW.toISOString();
    const res = await exportGet(
      new NextRequest(`http://localhost/api/export?type=bookings&from=${boundary}&to=${boundary}`),
    );
    expect(res.status).toBe(200);
    const rows = (await res.text()).split("\r\n").slice(1);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.startsWith(boundary))).toBe(true);
  });

  it("GET /api/export?type=unknown still 400s", async () => {
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=unknown"));
    expect(res.status).toBe(400);
  });
});
