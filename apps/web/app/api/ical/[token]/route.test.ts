import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/ical/[token]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const NOW_ISO = NOW.toISOString();

const requestFeed = (token: string, request?: NextRequest): Promise<Response> =>
  GET(request ?? new NextRequest(`http://localhost/api/ical/${token}`), {
    params: Promise.resolve({ token }),
  });

describe("GET /api/ical/[token]", () => {
  let seed: SeedData;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    seed = buildSeed(NOW);
    __setTestRepositories(createInMemoryRepositories(seed));
  });
  afterEach(() => {
    __setTestRepositories(null);
    vi.useRealTimers();
  });

  it("returns an iCalendar feed for a known token", async () => {
    const res = await requestFeed("ical-token-amara");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("END:VCALENDAR");
  });

  it("contains only the token-holder's upcoming booked sessions", async () => {
    const amara = seed.members[0];
    const bram = seed.members[1];

    const res = await requestFeed(amara.icalToken);
    const body = await res.text();

    // Exactly Amara's confirmed, future sessions appear as VEVENTs.
    const expected = seed.bookings
      .filter(
        (booking) =>
          booking.memberId === amara.id &&
          booking.status === "booked" &&
          booking.cancelledAt === null,
      )
      .map((booking) => seed.sessions.find((s) => s.id === booking.sessionId))
      .filter((s) => s !== undefined && s.startsAt >= NOW_ISO);
    expect(expected.length).toBeGreaterThan(0);
    expect(body.split("BEGIN:VEVENT").length - 1).toBe(expected.length);
    for (const session of expected) {
      expect(body).toContain(`UID:${session.id}@studiobook`);
    }

    // A future session only Bram booked must not leak into Amara's feed.
    const bramOnly = seed.bookings.find(
      (booking) =>
        booking.memberId === bram.id &&
        booking.status === "booked" &&
        seed.sessions.some((s) => s.id === booking.sessionId && s.startsAt >= NOW_ISO) &&
        !seed.bookings.some(
          (other) =>
            other.memberId === amara.id &&
            other.sessionId === booking.sessionId &&
            other.status === "booked",
        ),
    );
    if (!bramOnly) throw new Error("seed should include a Bram-only future session");
    expect(body).not.toContain(`UID:${bramOnly.sessionId}@studiobook`);

    // Amara's own past sessions are excluded too.
    const past = seed.bookings.find(
      (booking) =>
        booking.memberId === amara.id &&
        seed.sessions.some((s) => s.id === booking.sessionId && s.startsAt < NOW_ISO),
    );
    if (!past) throw new Error("seed should include a past booking for Amara");
    expect(body).not.toContain(`UID:${past.sessionId}@studiobook`);
  });

  it("404s for an unknown token", async () => {
    const res = await requestFeed("no-such-token");
    expect(res.status).toBe(404);
  });

  it("404s for an empty token", async () => {
    const res = await requestFeed("");
    expect(res.status).toBe(404);
  });

  it("needs no session cookie — the token alone authorizes the feed", async () => {
    const request = new NextRequest("http://localhost/api/ical/ical-token-amara");
    expect(request.cookies.getAll()).toHaveLength(0);
    const res = await requestFeed("ical-token-amara", request);
    expect(res.status).toBe(200);
  });
});
