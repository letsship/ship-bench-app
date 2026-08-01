import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { GET } from "./route";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// No cookie header anywhere: the secret token in the path is the authorization.
function get(token: string): Promise<Response> {
  return GET(new Request(`http://localhost/api/ical/${token}`), {
    params: Promise.resolve({ token }),
  });
}

describe("GET /api/ical/[token]", () => {
  let seed: SeedData;

  beforeEach(() => {
    // The route compares session times against the real clock; pin it to the
    // seed's reference time so past/future splits are deterministic.
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    seed = buildSeed(NOW);
    __setTestRepositories(createInMemoryRepositories(seed));
  });

  afterEach(() => {
    vi.useRealTimers();
    __setTestRepositories(null);
  });

  it("returns text/calendar with only the member's upcoming booked sessions", async () => {
    const member = seed.members[0];
    const res = await get(member.calendarToken);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    const body = await res.text();

    const futureSessionIds = new Set(
      seed.sessions.filter((s) => s.startsAt >= NOW.toISOString()).map((s) => s.id),
    );
    const expectedIds = new Set(
      seed.bookings
        .filter((b) => b.memberId === member.id && b.status === "booked")
        .map((b) => b.sessionId)
        .filter((sessionId) => futureSessionIds.has(sessionId)),
    );
    expect(expectedIds.size).toBeGreaterThan(0);
    for (const sessionId of expectedIds) {
      expect(body).toContain(`UID:${sessionId}@studiobook`);
    }

    // Nothing else leaks: every UID in the feed is one of the member's own
    // upcoming booked sessions — no other members' sessions, no past sessions.
    const uids = [...body.matchAll(/UID:([^\r\n]+)/g)].map((match) => match[1]);
    expect(uids).toHaveLength(expectedIds.size);
    expect(uids.every((uid) => expectedIds.has(uid.replace("@studiobook", "")))).toBe(true);
  });

  it("does not include a past session the member attended", async () => {
    const member = seed.members[0];
    const pastSessionIds = new Set(
      seed.sessions.filter((s) => s.startsAt < NOW.toISOString()).map((s) => s.id),
    );
    const pastBooking = seed.bookings.find(
      (b) => b.memberId === member.id && pastSessionIds.has(b.sessionId),
    );
    expect(pastBooking).toBeDefined();
    const body = await (await get(member.calendarToken)).text();
    expect(body).not.toContain(`UID:${pastBooking?.sessionId}@studiobook`);
  });

  it("returns 404 for an unknown token", async () => {
    const res = await get("not-a-real-token");
    expect(res.status).toBe(404);
  });

  it("returns 404 for an empty token", async () => {
    const res = await get("");
    expect(res.status).toBe(404);
  });
});
