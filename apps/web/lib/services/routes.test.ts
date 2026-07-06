import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { requireSession } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { HttpError } from "@/lib/http";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
    vi.mocked(requireSession).mockResolvedValue({ email: "founder@example.com" });
  });
  afterEach(() => {
    __setTestRepositories(null);
    vi.mocked(requireSession).mockReset();
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
    expect(res.headers.get("content-type")).toContain("text/csv");
    const csv = await res.text();
    const [header] = csv.split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
  });

  it("GET /api/export?type=bookings keeps a session exactly on the `to` boundary", async () => {
    const reference = createInMemoryRepositories(buildSeed(NOW));
    const studio = await reference.studios.getFirst();
    const sessions = await reference.classSessions.listByStudio(studio?.id ?? "");
    const boundary = sessions[Math.floor(sessions.length / 2)].startsAt;

    const res = await exportGet(
      new NextRequest(
        `http://localhost/api/export?type=bookings&to=${encodeURIComponent(boundary)}`,
      ),
    );
    expect(res.status).toBe(200);
    const csv = await res.text();
    const rows = csv.split("\r\n").slice(1);
    expect(rows.some((row) => row.startsWith(boundary))).toBe(true);
    expect(rows.every((row) => row.split(",")[0] <= boundary)).toBe(true);
  });

  it("GET /api/export returns 401 without a session", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(
      new HttpError(401, "unauthorized", "Sign in required"),
    );
    const res = await exportGet(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(401);
  });
});
