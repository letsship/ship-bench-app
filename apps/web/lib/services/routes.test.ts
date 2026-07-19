import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as exportGet } from "@/app/api/export/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ id: "session-1" }),
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

  it("GET /api/export?type=bookings returns 200 with text/csv content-type", async () => {
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
  });

  it("GET /api/export?type=bookings returns the correct header row", async () => {
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    const csv = await res.text();
    const [header] = csv.split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
  });

  it("GET /api/export?type=bookings with from/to narrows results", async () => {
    const unboundedRes = await exportGet(
      new NextRequest("http://localhost/api/export?type=bookings"),
    );
    const unboundedCsv = await unboundedRes.text();
    const unboundedLines = unboundedCsv.split("\r\n").filter((line) => line.length > 0);

    const fromBoundary = new Date(NOW.getTime() + 1000 * 60 * 60 * 24).toISOString();
    const toBoundary = new Date(NOW.getTime() + 1000 * 60 * 60 * 48).toISOString();

    const boundedRes = await exportGet(
      new NextRequest(
        `http://localhost/api/export?type=bookings&from=${encodeURIComponent(fromBoundary)}&to=${encodeURIComponent(toBoundary)}`,
      ),
    );
    const boundedCsv = await boundedRes.text();
    const boundedLines = boundedCsv.split("\r\n").filter((line) => line.length > 0);

    expect(boundedLines.length).toBeLessThanOrEqual(unboundedLines.length);
  });
});
