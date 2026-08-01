import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-07-01T12:00:00.000Z");

describe("GET /api/ical/[token]", () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW }));
  afterEach(() => {
    vi.useRealTimers();
    __setTestRepositories(null);
  });

  it("returns an iCalendar feed without requiring a session cookie", async () => {
    const seed = buildSeed(NOW);
    __setTestRepositories(createInMemoryRepositories(seed));
    const response = await GET(new Request("http://localhost/api/ical/token"), {
      params: Promise.resolve({ token: seed.members[0].calendarToken }),
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^text\/calendar/);
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("END:VCALENDAR");
    expect(body).toContain("SUMMARY:");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("returns 404 for an unknown token", async () => {
    const seed = buildSeed(NOW);
    __setTestRepositories(createInMemoryRepositories(seed));
    const response = await GET(new Request("http://localhost/api/ical/unknown"), {
      params: Promise.resolve({ token: "unknown-token" }),
    });
    expect(response.status).toBe(404);
  });
});
