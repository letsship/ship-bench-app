import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as exportGet } from "@/app/api/export/route";
import { requireSession } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { HttpError } from "@/lib/http";

// The export route guards every type with requireSession(). Mock it so a signed-in
// session is present by default; individual tests override the implementation
// to assert the auth rejection path. None of the other GET routes under test
// call requireSession(), so this mock is a no-op for them.
vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(async () => ({ email: "bookkeeper@example.com" })),
  SESSION_COOKIE: "studiobook-session",
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
});

describe("GET /api/export?type=bookings", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
    vi.mocked(requireSession).mockResolvedValue({ email: "bookkeeper@example.com" });
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns a text/csv body with the Starts,Class,Member,Email,Status header", async () => {
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("studiobook-bookings.csv");
    const body = await res.text();
    expect(body.split("\r\n")[0]).toBe("Starts,Class,Member,Email,Status");
  });

  it("rejects an unknown export type with 400", async () => {
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=notarealtype"));
    expect(res.status).toBe(400);
  });

  it("rejects a missing session with 401", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(
      new HttpError(401, "unauthorized", "Sign in required"),
    );
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(401);
  });
});
