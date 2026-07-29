import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "admin@test.com" }),
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

  describe("GET /api/export", () => {
    it("type=bookings returns 200 CSV with the correct header", async () => {
      const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
      const body = await res.text();
      const [header] = body.split("\r\n");
      expect(header).toBe("Starts,Class,Member,Email,Status");
    });

    it("honours inclusive from/to bounds", async () => {
      const res = await exportGet(
        new NextRequest(
          "http://localhost/api/export?type=bookings&from=2026-03-01T00:00:00.000Z&to=2026-03-15T17:00:00.000Z",
        ),
      );
      expect(res.status).toBe(200);
      const body = await res.text();
      const lines = body.trim().split("\r\n");
      // header + at least one data row
      expect(lines.length).toBeGreaterThan(1);
    });

    it("omitting both bounds returns all bookings", async () => {
      const noBounds = await exportGet(
        new NextRequest("http://localhost/api/export?type=bookings"),
      );
      expect(noBounds.status).toBe(200);
      const allCsv = await noBounds.text();
      const allLines = allCsv.trim().split("\r\n");

      const withBounds = await exportGet(
        new NextRequest(
          "http://localhost/api/export?type=bookings&from=2099-01-01T00:00:00.000Z&to=2099-12-31T23:59:59.000Z",
        ),
      );
      expect(withBounds.status).toBe(200);
      const emptyCsv = await withBounds.text();
      const emptyLines = emptyCsv.trim().split("\r\n");
      // Only header when range matches nothing
      expect(emptyLines).toEqual(["Starts,Class,Member,Email,Status"]);

      // Unbounded returns more rows than the future-only range
      expect(allLines.length).toBeGreaterThan(emptyLines.length);
    });

    it("unknown type yields 400", async () => {
      const res = await exportGet(new NextRequest("http://localhost/api/export?type=nope"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toHaveProperty("error");
    });

    it("type=invoices still works alongside bookings", async () => {
      const res = await exportGet(new NextRequest("http://localhost/api/export?type=invoices"));
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("Number");
    });

    it("type=members still works alongside bookings", async () => {
      const res = await exportGet(new NextRequest("http://localhost/api/export?type=members"));
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("Name");
    });
  });
});