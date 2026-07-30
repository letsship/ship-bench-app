import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as classesGet } from "@/app/api/classes/route";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// The export route requires a signed-in operator, so the cookie jar that
// `requireSession()` reads is backed by a plain map here. The token itself is
// real (HMAC-signed by lib/auth/session); only the store is faked.
const cookieJar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name),
  }),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");

// Seeded sessions run three a day (08:00/12:00/17:00 UTC) around NOW.
const DAY = "2026-03-15";
const MORNING = `${DAY}T08:00:00.000Z`;
const MIDDAY = `${DAY}T12:00:00.000Z`;
const EVENING = `${DAY}T17:00:00.000Z`;

async function exportBookings(query = ""): Promise<{ res: Response; lines: string[] }> {
  const res = await exportGet(new NextRequest(`http://localhost/api/export?type=bookings${query}`));
  return { res, lines: (await res.text()).split("\r\n") };
}

const startsColumn = (lines: string[]): string[] =>
  lines.slice(1).map((line) => line.split(",")[0]);

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(async () => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
    cookieJar.set(SESSION_COOKIE, await createSessionToken("ops@riverbank.test"));
  });
  afterEach(() => {
    __setTestRepositories(null);
    cookieJar.clear();
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
    const { res, lines } = await exportBookings();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toContain("studiobook-bookings.csv");
    expect(lines[0]).toBe("Starts,Class,Member,Email,Status");
    expect(lines.length).toBeGreaterThan(1);
  });

  it("GET /api/export?type=bookings requires a signed-in session", async () => {
    cookieJar.clear();
    const { res } = await exportBookings();
    expect(res.status).toBe(401);
  });

  it("GET /api/export?type=bookings treats both range bounds as inclusive", async () => {
    const { lines } = await exportBookings(`&from=${MORNING}&to=${MIDDAY}`);
    const starts = startsColumn(lines);
    expect(starts.length).toBeGreaterThan(0);
    expect(new Set(starts)).toEqual(new Set([MORNING, MIDDAY]));
    // The exact `to` instant must survive — repositories treat `to` as exclusive.
    expect(starts).toContain(MIDDAY);
  });

  it("GET /api/export?type=bookings leaves an omitted bound unbounded", async () => {
    const fromOnly = startsColumn((await exportBookings(`&from=${EVENING}`)).lines);
    expect(fromOnly.length).toBeGreaterThan(0);
    expect(fromOnly.every((start) => start >= EVENING)).toBe(true);

    const toOnly = startsColumn((await exportBookings(`&to=${MORNING}`)).lines);
    expect(toOnly.length).toBeGreaterThan(0);
    expect(toOnly.every((start) => start <= MORNING)).toBe(true);
  });
});
