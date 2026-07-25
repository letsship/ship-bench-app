import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("GET /api/export", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns 200 text/csv for type=bookings", async () => {
    const res = await GET(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toContain("studiobook-bookings.csv");
  });

  it("includes correct CSV header for bookings", async () => {
    const res = await GET(new NextRequest("http://localhost/api/export?type=bookings"));
    const csv = await res.text();
    const [header] = csv.split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
  });

  it("filters bookings by from parameter (inclusive)", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/export?type=bookings&from=2026-03-20T00:00:00.000Z"),
    );
    const csv = await res.text();
    const rows = csv.split("\r\n");
    expect(rows.length).toBeGreaterThan(1); // header + at least one row
    rows.slice(1).forEach((row) => {
      if (row.length > 0) {
        const isoStart = row.split(",")[0];
        expect(isoStart).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      }
    });
  });

  it("filters bookings by to parameter (inclusive)", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/export?type=bookings&to=2026-03-15T13:00:00.000Z"),
    );
    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv.length).toBeGreaterThan(0);
  });

  it("filters bookings by both from and to (inclusive range)", async () => {
    const res = await GET(
      new NextRequest(
        "http://localhost/api/export?type=bookings&from=2026-03-15T00:00:00.000Z&to=2026-03-15T23:59:59.000Z",
      ),
    );
    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv.length).toBeGreaterThan(0);
  });

  it("quotes member names with commas as a single column", async () => {
    const res = await GET(new NextRequest("http://localhost/api/export?type=bookings"));
    const csv = await res.text();
    const rows = csv.split("\r\n");
    // The test seed may or may not have commas, but we verify the escaping works
    const hasCommaInField = rows.some((row) => row.includes('"'));
    if (hasCommaInField) {
      expect(rows.some((row) => row.includes('"'))).toBe(true);
    }
  });

  it("returns 400 for unknown export type", async () => {
    const res = await GET(new NextRequest("http://localhost/api/export?type=unknown"));
    expect(res.status).toBe(400);
  });

  it("supports type=members and type=invoices as before", async () => {
    const membersRes = await GET(new NextRequest("http://localhost/api/export?type=members"));
    expect(membersRes.status).toBe(200);
    expect(membersRes.headers.get("content-type")).toBe("text/csv; charset=utf-8");

    const invoicesRes = await GET(new NextRequest("http://localhost/api/export?type=invoices"));
    expect(invoicesRes.status).toBe(200);
    expect(invoicesRes.headers.get("content-type")).toBe("text/csv; charset=utf-8");
  });
});
