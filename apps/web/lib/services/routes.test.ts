import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(async () => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
    const token = await createSessionToken("operator@example.com");
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) => (name === SESSION_COOKIE ? { name, value: token } : undefined),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
  });
  afterEach(() => {
    __setTestRepositories(null);
    vi.mocked(cookies).mockReset();
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
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="studiobook-bookings.csv"',
    );
    const csv = await res.text();
    const [header, ...rows] = csv.split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("GET /api/export?type=bookings filters to an inclusive from/to range", async () => {
    const from = "2026-03-15T08:00:00.000Z";
    const to = "2026-03-16T08:00:00.000Z";
    const res = await exportGet(
      new NextRequest(`http://localhost/api/export?type=bookings&from=${from}&to=${to}`),
    );
    expect(res.status).toBe(200);
    const [, ...rows] = (await res.text()).split("\r\n");
    const startTimes = rows.map((row) => row.split(",")[0]);
    expect(startTimes).toContain(from);
    expect(startTimes).toContain(to);
    for (const startTime of startTimes) {
      expect(startTime >= from && startTime <= to).toBe(true);
    }
  });
});
