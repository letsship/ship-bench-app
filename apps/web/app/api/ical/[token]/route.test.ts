import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import { GET } from "./route";

// No fixed NOW here: the route (via the member-calendar service) filters
// sessions against the real clock, so the seed must be built against `now` as
// well for its sessions to land in the future the route actually checks.

function callWithToken(token: string): Promise<Response> {
  return GET(new NextRequest(`http://localhost/api/ical/${encodeURIComponent(token)}`), {
    params: Promise.resolve({ token }),
  });
}

describe("GET /api/ical/[token]", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed());
    __setTestRepositories(repos);
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns only the token holder's own upcoming booked sessions", async () => {
    const studio = await repos.studios.getFirst();
    const sessions = await repos.classSessions.listByStudio(studio!.id, {
      from: new Date().toISOString(),
    });
    const bookings = await repos.bookings.listBySessionIds(sessions.map((session) => session.id));
    const upcomingBooked = bookings.filter((booking) => booking.status === "booked");
    const members = await repos.members.listByStudio(studio!.id);

    const ownerId = upcomingBooked[0].memberId;
    const owner = members.find((member) => member.id === ownerId)!;
    const ownSessionIds = new Set(
      upcomingBooked.filter((booking) => booking.memberId === ownerId).map((b) => b.sessionId),
    );
    const foreignSessionIds = new Set(
      upcomingBooked
        .filter((booking) => booking.memberId !== ownerId && !ownSessionIds.has(booking.sessionId))
        .map((b) => b.sessionId),
    );
    // The seed spreads bookings across many members, so there should be
    // sessions booked by someone else that must NOT leak into this feed.
    expect(foreignSessionIds.size).toBeGreaterThan(0);

    const res = await callWithToken(owner.calendarToken);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    const body = await res.text();

    for (const sessionId of ownSessionIds) {
      expect(body).toContain(`UID:${sessionId}@studiobook`);
    }
    for (const sessionId of foreignSessionIds) {
      expect(body).not.toContain(`UID:${sessionId}@studiobook`);
    }
  });

  it("404s for an unknown token", async () => {
    const res = await callWithToken("this-token-does-not-exist");
    expect(res.status).toBe(404);
  });

  it("404s for an empty token", async () => {
    const res = await callWithToken("");
    expect(res.status).toBe(404);
  });
});
