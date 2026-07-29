import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/export/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth/session";

const NOW = new Date("2026-03-15T12:00:00.000Z");

async function authedRequest(url: string): Promise<NextRequest> {
  const token = await createSessionToken("bookkeeper@example.com");
  return new NextRequest(url, {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
  });
}

describe("GET /api/export (against injected fake repositories)", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns a 200 CSV with the bookings header for type=bookings", async () => {
    const res = await GET(await authedRequest("http://localhost/api/export?type=bookings"));
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
      await authedRequest(
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
    const res = await GET(await authedRequest("http://localhost/api/export?type=nope"));
    expect(res.status).toBe(400);
  });

  it("returns 401 without a signed-in session", async () => {
    const res = await GET(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(401);
  });
});
