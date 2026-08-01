import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories, type SeedData } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { GET } from "./route";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "founder@example.com" }),
}));

const NOW = new Date("2026-06-15T10:00:00.000Z");

describe("GET /api/export", () => {
  let seed: SeedData;

  beforeEach(() => {
    seed = buildSeed(NOW);
    __setTestRepositories(createInMemoryRepositories(seed));
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("exports bookings as CSV", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/export?type=bookings"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect((await response.text()).split("\r\n")[0]).toBe(
      "Starts,Class,Member,Email,Status",
    );
  });

  it("applies inclusive from and to bounds", async () => {
    const bookedSessionIds = new Set(seed.bookings.map((booking) => booking.sessionId));
    const starts = seed.sessions
      .filter((session) => bookedSessionIds.has(session.id))
      .map((session) => session.startsAt)
      .sort();
    const from = starts[1];
    const to = starts[2];
    const response = await GET(
      new NextRequest(
        `http://localhost/api/export?type=bookings&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
    );

    const rows = (await response.text()).split("\r\n").slice(1);
    const exportedStarts = rows.map((row) => row.split(",")[0]);
    expect(response.status).toBe(200);
    expect(new Set(exportedStarts)).toEqual(new Set([from, to]));
  });

  it("rejects an unknown export type", async () => {
    const response = await GET(new NextRequest("http://localhost/api/export?type=unknown"));

    expect(response.status).toBe(400);
  });
});
