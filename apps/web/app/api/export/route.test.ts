import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { GET } from "./route";

let testCookies: Record<string, string> = {};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (testCookies[name] ? { value: testCookies[name] } : undefined),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("GET /api/export?type=bookings", () => {
  beforeEach(async () => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
    const token = await createSessionToken("test@example.com");
    testCookies = { [SESSION_COOKIE]: token };
  });
  afterEach(() => {
    __setTestRepositories(null);
    testCookies = {};
  });

  it("returns 200 with text/csv content type", async () => {
    const res = await GET(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
  });

  it("returns the correct CSV header", async () => {
    const res = await GET(new NextRequest("http://localhost/api/export?type=bookings"));
    const csv = await res.text();
    const [header] = csv.split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
  });

  it("includes bookings in the response", async () => {
    const res = await GET(new NextRequest("http://localhost/api/export?type=bookings"));
    const csv = await res.text();
    const lines = csv.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
  });

  it("filters by from query param (inclusive)", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/export?type=bookings&from=2099-01-01T00:00:00Z"),
    );
    const csv = await res.text();
    const lines = csv.split("\r\n");
    expect(lines.length).toBe(1); // Only header
  });

  it("filters by to query param (inclusive)", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/export?type=bookings&to=2000-01-01T00:00:00Z"),
    );
    const csv = await res.text();
    const lines = csv.split("\r\n");
    expect(lines.length).toBe(1); // Only header
  });

  it("sets filename in content-disposition", async () => {
    const res = await GET(new NextRequest("http://localhost/api/export?type=bookings"));
    const disposition = res.headers.get("content-disposition");
    expect(disposition).toContain('filename="studiobook-bookings.csv"');
  });

  it("returns 401 when unauthenticated", async () => {
    testCookies = {};
    const res = await GET(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(401);
  });
});
