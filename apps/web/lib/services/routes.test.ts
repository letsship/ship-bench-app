import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { createSessionToken } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// The export route is session-gated, so stand in for the cookie jar: the real
// HMAC token still has to verify, only the store is faked.
const cookieState = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieState.token ? { name, value: cookieState.token } : undefined),
  }),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");

const exportCsv = async (query: string): Promise<string[]> => {
  const res = await exportGet(new NextRequest(`http://localhost/api/export?${query}`));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
  return (await res.text()).split("\r\n");
};

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(async () => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
    cookieState.token = await createSessionToken("owner@example.com");
  });
  afterEach(() => {
    __setTestRepositories(null);
    cookieState.token = null;
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

  it("GET /api/export?type=bookings returns the accounting CSV", async () => {
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toContain("studiobook-bookings.csv");
    const [header, ...rows] = (await res.text()).split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("GET /api/export?type=bookings filters inclusively on both bounds", async () => {
    const all = await exportCsv("type=bookings");
    const starts = all.slice(1).map((row) => row.split(",")[0]);
    const first = starts[0];
    const last = starts[starts.length - 1];
    expect(first).not.toBe(last);

    const clamped = await exportCsv(`type=bookings&from=${first}&to=${last}`);
    expect(clamped).toEqual(all);

    const onlyFirst = await exportCsv(`type=bookings&from=${first}&to=${first}`);
    expect(onlyFirst.length).toBeGreaterThan(1);
    expect(onlyFirst.slice(1).every((row) => row.startsWith(`${first},`))).toBe(true);

    const excluded = await exportCsv(`type=bookings&from=2099-01-01T00:00:00.000Z`);
    expect(excluded).toEqual(["Starts,Class,Member,Email,Status"]);
  });

  it("GET /api/export requires a signed-in session", async () => {
    cookieState.token = null;
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(401);
  });

  it("GET /api/export rejects an unknown type", async () => {
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=nope"));
    expect(res.status).toBe(400);
  });
});
