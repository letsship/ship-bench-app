import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

vi.mock("@/lib/auth/session", () => ({
  requireSession: async () => ({ email: "owner@example.com" }),
}));

const { GET } = await import("./route");

const NOW = new Date("2026-06-15T12:00:00.000Z");

describe("GET /api/export", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns bookings as CSV with the required header row", async () => {
    const res = await GET(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const body = await res.text();
    const [header] = body.split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
  });

  it("filters bookings to an inclusive from/to range", async () => {
    const full = await (
      await GET(new NextRequest("http://localhost/api/export?type=bookings"))
    ).text();
    const fullRows = full.split("\r\n").slice(1).filter(Boolean);
    expect(fullRows.length).toBeGreaterThan(0);

    const firstStarts = fullRows[0].split(",")[0];
    const res = await GET(
      new NextRequest(
        `http://localhost/api/export?type=bookings&from=${firstStarts}&to=${firstStarts}`,
      ),
    );
    expect(res.status).toBe(200);
    const rows = (await res.text()).split("\r\n").slice(1).filter(Boolean);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.startsWith(firstStarts)).toBe(true);
    }

    const outOfRange = await GET(
      new NextRequest("http://localhost/api/export?type=bookings&from=2099-01-01T00:00:00.000Z"),
    );
    const outOfRangeRows = (await outOfRange.text()).split("\r\n").slice(1).filter(Boolean);
    expect(outOfRangeRows.length).toBe(0);
  });

  it("still 400s on an unknown export type", async () => {
    const res = await GET(new NextRequest("http://localhost/api/export?type=bogus"));
    expect(res.status).toBe(400);
  });
});
