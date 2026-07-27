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
  requireSession: vi.fn().mockResolvedValue({ email: "owner@example.com" }),
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

  it("GET /api/export?type=bookings returns a CSV with the expected header row", async () => {
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const body = await res.text();
    const [header, ...rows] = body.split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("GET /api/export?type=bookings filters inclusively on the from/to window", async () => {
    const all = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    const [, firstRow] = (await all.text()).split("\r\n");
    const startsAt = firstRow.split(",")[0];

    const res = await exportGet(
      new NextRequest(`http://localhost/api/export?type=bookings&from=${startsAt}&to=${startsAt}`),
    );
    expect(res.status).toBe(200);
    const [, ...rows] = (await res.text()).split("\r\n");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.split(",")[0]).toBe(startsAt);
    }
  });

  it("GET /api/export?type=bookings yields only the header outside the window", async () => {
    const res = await exportGet(
      new NextRequest("http://localhost/api/export?type=bookings&to=2000-01-01T00:00:00.000Z"),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Starts,Class,Member,Email,Status");
  });
});
