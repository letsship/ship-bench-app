import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/export/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// `requireSession()` reads the session cookie via `cookies()` from
// `next/headers`, which only works inside a live Next request scope. In a
// Vitest route test there is no such scope, so we mock the session module and
// toggle authorisation through `sessionAuthorized` instead.
let sessionAuthorized = true;
vi.mock("@/lib/auth/session", () => ({
  requireSession: async () => {
    if (!sessionAuthorized) {
      const { HttpError } = await import("@/lib/http");
      throw new HttpError(401, "unauthorized", "Sign in required");
    }
    return { email: "bookkeeper@example.com" };
  },
}));

function authedRequest(url: string): NextRequest {
  return new NextRequest(url);
}

describe("GET /api/export (against injected fake repositories)", () => {
  beforeEach(() => {
    sessionAuthorized = true;
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns a 200 CSV with the bookings header for type=bookings", async () => {
    const res = await GET(authedRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="studiobook-bookings.csv"',
    );
    const text = await res.text();
    const header = text.split("\r\n")[0];
    expect(header).toBe("Starts,Class,Member,Email,Status");
    // At least one data row beyond the header.
    expect(text.split("\r\n").length).toBeGreaterThan(1);
  });

  it("narrows rows inclusively with from and to query params", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    const studio = await repos.studios.getFirst();
    const sessions = (await repos.classSessions.listByStudio(studio!.id))
      .map((s) => s.startsAt)
      .sort((a, b) => a.localeCompare(b));
    const from = sessions[0];
    const to = sessions[sessions.length - 1];

    const res = await GET(
      authedRequest(
        `http://localhost/api/export?type=bookings&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    const lines = text.split("\r\n");
    // header + at least the rows at both endpoints
    const starts = lines.slice(1).map((line) => line.split(",")[0]);
    expect(starts).toContain(from);
    expect(starts).toContain(to);
  });

  it("returns 400 for an unknown export type", async () => {
    const res = await GET(authedRequest("http://localhost/api/export?type=nope"));
    expect(res.status).toBe(400);
  });

  it("returns 401 without a signed-in session", async () => {
    sessionAuthorized = false;
    const res = await GET(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(401);
  });
});
