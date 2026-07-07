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

const NOW = new Date("2026-03-15T12:00:00.000Z");

// `cookies()` from next/headers reads from a request-scoped store that only
// exists inside a real Next request. In this unit harness we drive the route
// handlers directly, so mock next/headers with a plain cookie jar the tests
// can populate. `vi.hoisted` runs before imports so the jar exists when the
// mocked module is first loaded by the route under test; this lets
// requireSession() resolve a real signed token (or see no cookie and 401)
// without spinning up a server.
const { cookieJar } = vi.hoisted(() => ({ cookieJar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name),
  }),
}));

async function signedIn(url: string): Promise<NextRequest> {
  cookieJar.set(SESSION_COOKIE, await createSessionToken("bookkeeper@example.com"));
  return new NextRequest(url);
}

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
    cookieJar.clear();
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

  it("GET /api/export?type=bookings returns a CSV with the required header row", async () => {
    const res = await exportGet(await signedIn("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    const csv = await res.text();
    expect(csv.split("\r\n")[0]).toBe("Starts,Class,Member,Email,Status");
  });

  it("GET /api/export?type=bookings honours a from/to range", async () => {
    const noRange = await exportGet(await signedIn("http://localhost/api/export?type=bookings"));
    const fullBody = await noRange.text();
    const fullRows = fullBody.split("\r\n").length;

    const res = await exportGet(
      await signedIn(
        "http://localhost/api/export?type=bookings&from=2099-01-01T00:00:00.000Z&to=2099-12-31T00:00:00.000Z",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    // Header only — no booking falls in 2099.
    expect(body.split("\r\n")).toHaveLength(1);
    expect(fullRows).toBeGreaterThan(1);
  });

  it("GET /api/export?type=bookings requires a signed-in session", async () => {
    // No session cookie set — guard rejects before any work happens.
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(401);
  });
});
