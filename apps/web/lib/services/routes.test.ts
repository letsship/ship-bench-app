import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// Session-gated routes read the session cookie via next/headers, which has no
// request scope under vitest. Hand it a cookie store carrying a real signed
// session token so requireSession exercises the actual verification path.
vi.mock("next/headers", () => ({
  cookies: async () => {
    const { SESSION_COOKIE, createSessionToken } = await import("@/lib/auth/session");
    const token = await createSessionToken("owner@example.com");
    return {
      get: (name: string) => (name === SESSION_COOKIE ? { value: token } : undefined),
    };
  },
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

  it("GET /api/export?type=bookings returns the bookings CSV", async () => {
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("studiobook-bookings.csv");
    const lines = (await res.text()).split("\r\n");
    expect(lines[0]).toBe("Starts,Class,Member,Email,Status");
    expect(lines.length).toBeGreaterThan(1);
  });

  it("GET /api/export?type=bookings scopes rows to [from, to] inclusive", async () => {
    // The seed has a session at exactly 2026-03-15T08:00:00.000Z; a range whose
    // bounds both equal that instant must still include its bookings.
    const res = await exportGet(
      new NextRequest(
        "http://localhost/api/export?type=bookings" +
          "&from=2026-03-15T08:00:00.000Z&to=2026-03-15T08:00:00.000Z",
      ),
    );
    expect(res.status).toBe(200);
    const lines = (await res.text()).split("\r\n");
    expect(lines[0]).toBe("Starts,Class,Member,Email,Status");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines.slice(1)) {
      expect(line.startsWith("2026-03-15T08:00:00.000Z,")).toBe(true);
    }

    const future = await exportGet(
      new NextRequest("http://localhost/api/export?type=bookings&from=2099-01-01T00:00:00.000Z"),
    );
    expect((await future.text()).split("\r\n")).toEqual(["Starts,Class,Member,Email,Status"]);
  });
});
