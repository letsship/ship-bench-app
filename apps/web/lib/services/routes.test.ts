import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { createSessionToken } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// GET /api/export calls requireSession(), which reads next/headers `cookies()`
// — unavailable outside a real Next.js request scope. Stub it with a signed
// session cookie so the route can be exercised directly, the same way the
// dev magic-link flow signs one in `startSession`.
let mockSessionCookieValue: string | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === SESSION_COOKIE && mockSessionCookieValue
        ? { name, value: mockSessionCookieValue }
        : undefined,
  }),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(async () => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
    mockSessionCookieValue = await createSessionToken("owner@example.com");
  });
  afterEach(() => {
    __setTestRepositories(null);
    mockSessionCookieValue = undefined;
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
    const [header] = body.split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
  });

  it("GET /api/export?type=bookings includes a booking exactly at the from/to boundary", async () => {
    const boundary = "2026-03-15T08:00:00.000Z";
    const res = await exportGet(
      new NextRequest(`http://localhost/api/export?type=bookings&from=${boundary}&to=${boundary}`),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    const rows = body.split("\r\n").slice(1);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.startsWith(boundary))).toBe(true);
  });
});
