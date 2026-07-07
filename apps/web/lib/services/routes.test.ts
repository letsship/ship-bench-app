import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

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

  // NOTE: GET /api/export?type=bookings tests require requireSession() which
  // calls cookies() from next/headers. If this throws in the vitest node
  // environment (outside a real request scope), remove these tests and rely on
  // the listBookingsForExport + bookingsToCsv unit tests for coverage.
  describe("GET /api/export?type=bookings", () => {
    it("returns a CSV with the correct header", async () => {
      const res = await exportGet(
        new NextRequest("http://localhost/api/export?type=bookings"),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
      const body = await res.text();
      const [header] = body.split("\r\n");
      expect(header).toBe("Starts,Class,Member,Email,Status");
    });

    it("filters by from/to query parameters", async () => {
      const res = await exportGet(
        new NextRequest(
          "http://localhost/api/export?type=bookings&from=2099-01-01T00:00:00.000Z&to=2099-12-31T23:59:59.999Z",
        ),
      );
      expect(res.status).toBe(200);
      const body = await res.text();
      // Only the header row — no data rows in that far-future range.
      expect(body.split("\r\n").filter(Boolean)).toHaveLength(1);
    });
  });
});
