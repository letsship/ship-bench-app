import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "test@example.com" }),
}));

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

  it("GET /api/export?type=bookings returns a CSV", async () => {
    const req = new NextRequest("http://localhost/api/export?type=bookings");
    const res = await exportGet(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const body = await res.text();
    expect(body).toContain("Starts,Class,Member,Email,Status");
    expect(body).toContain("booked");
  });

  it("GET /api/export returns 400 for an unknown type", async () => {
    const req = new NextRequest("http://localhost/api/export?type=unknown");
    const res = await exportGet(req);
    expect(res.status).toBe(400);
  });

  it("GET /api/export?type=bookings filters inclusively by from and to", async () => {
    const from = "2026-03-15T12:00:00.000Z";
    const to = "2026-03-15T12:00:00.000Z";
    const req = new NextRequest(
      `http://localhost/api/export?type=bookings&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
    const res = await exportGet(req);
    expect(res.status).toBe(200);
    const body = await res.text();
    const lines = body.split("\r\n");
    expect(lines[0]).toBe("Starts,Class,Member,Email,Status");
    for (let i = 1; i < lines.length; i += 1) {
      if (lines[i]) {
        expect(lines[i].startsWith(from)).toBe(true);
      }
    }
  });

  it("GET /api/export?type=bookings excludes sessions outside the range", async () => {
    const to = "2026-03-15T08:00:00.000Z";
    const req = new NextRequest(
      `http://localhost/api/export?type=bookings&to=${encodeURIComponent(to)}`,
    );
    const res = await exportGet(req);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("2026-03-15T08:00:00.000Z");
    expect(body).not.toContain("2026-03-15T12:00:00.000Z");
    expect(body).not.toContain("2026-03-15T17:00:00.000Z");
  });
});
