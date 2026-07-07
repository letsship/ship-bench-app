import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as exportGet } from "@/app/api/export/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { listBookingRows } from "./booking-list";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// The export route gates on `requireSession()`; no other test in this suite
// exercises a session-gated handler, so stub the session module here. Other GET
// handlers imported above don't call requireSession, so they're unaffected.
const { requireSessionMock } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(() => Promise.resolve({ email: "bookkeeper@example.com" })),
}));
vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>("@/lib/auth/session");
  return { ...actual, requireSession: requireSessionMock };
});

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

describe("GET /api/export?type=bookings (against injected fake repositories)", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
    requireSessionMock.mockReset();
    requireSessionMock.mockResolvedValue({ email: "bookkeeper@example.com" });
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns a CSV with the required header row and 200", async () => {
    const res = await exportGet(
      new NextRequest("http://localhost/api/export?type=bookings"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const body = await res.text();
    const header = body.split("\r\n")[0];
    expect(header).toBe("Starts,Class,Member,Email,Status");
  });

  it("returns all seeded bookings when no from/to is given", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const studioId = (await repos.studios.getFirst())!.id;
    const allRows = await listBookingRows(repos, studioId);
    const res = await exportGet(
      new NextRequest("http://localhost/api/export?type=bookings"),
    );
    const body = await res.text();
    // header + one row per booking
    expect(body.split("\r\n").length - 1).toBe(allRows.length);
  });

  it("includes a session whose startsAt exactly matches both from and to (inclusive both ends)", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const studioId = (await repos.studios.getFirst())!.id;
    const [firstRow] = await listBookingRows(repos, studioId);
    const exact = firstRow.startsAt;
    const res = await exportGet(
      new NextRequest(
        `http://localhost/api/export?type=bookings&from=${encodeURIComponent(exact)}&to=${encodeURIComponent(exact)}`,
      ),
    );
    const body = await res.text();
    const rows = body.split("\r\n").slice(1);
    expect(rows.some((r) => r.startsWith(exact + ","))).toBe(true);
  });

  it("treats a +00:00 offset timestamp the same as a Z timestamp for from/to (inclusive both ends)", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const studioId = (await repos.studios.getFirst())!.id;
    const [firstRow] = await listBookingRows(repos, studioId);
    // The seeded startsAt is a `Z` timestamp; rewrite the same instant using a
    // `+00:00` offset — the exact format the export's own Starts column emits
    // in production — and confirm inclusive filtering still matches.
    const offsetForm = firstRow.startsAt.replace(/Z$/, "+00:00");
    expect(offsetForm).not.toBe(firstRow.startsAt);
    const res = await exportGet(
      new NextRequest(
        `http://localhost/api/export?type=bookings&from=${encodeURIComponent(offsetForm)}&to=${encodeURIComponent(offsetForm)}`,
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    const rows = body.split("\r\n").slice(1);
    expect(rows.some((r) => r.startsWith(firstRow.startsAt + ","))).toBe(true);
  });

  it("rejects an unknown export type with 400", async () => {
    const res = await exportGet(
      new NextRequest("http://localhost/api/export?type=unknown"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 when there is no signed-in session", async () => {
    requireSessionMock.mockReset();
    const { HttpError } = await import("@/lib/http");
    requireSessionMock.mockImplementation(() => {
      throw new HttpError(401, "unauthorized", "Sign in required");
    });
    const res = await exportGet(
      new NextRequest("http://localhost/api/export?type=bookings"),
    );
    expect(res.status).toBe(401);
  });
});
