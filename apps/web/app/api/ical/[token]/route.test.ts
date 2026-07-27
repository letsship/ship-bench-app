import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/ical/[token]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// Anchored to the real clock: the route has no way to inject a fake "now" (it
// isn't given one — see member-calendar.ts), so fixtures must be genuinely
// future/past relative to the actual current time, matching services.test.ts.
const NOW = new Date();

function params(token: string): { params: Promise<{ token: string }> } {
  return { params: Promise.resolve({ token }) };
}

describe("GET /api/ical/[token]", () => {
  let seed: ReturnType<typeof buildSeed>;

  beforeEach(() => {
    seed = buildSeed(NOW);
    __setTestRepositories(createInMemoryRepositories(seed));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns only that member's future booked sessions, not another member's", async () => {
    const futureSessionIds = new Set(
      seed.sessions
        .filter((session) => new Date(session.startsAt) > NOW)
        .map((session) => session.id),
    );
    const member = seed.members.find((candidate) =>
      seed.bookings.some(
        (booking) =>
          booking.memberId === candidate.id &&
          booking.status === "booked" &&
          futureSessionIds.has(booking.sessionId),
      ),
    );
    if (!member) throw new Error("seed fixture expected to contain a future booked member");
    const ownSessionId = seed.bookings.find(
      (booking) =>
        booking.memberId === member.id &&
        booking.status === "booked" &&
        futureSessionIds.has(booking.sessionId),
    )?.sessionId as string;

    const foreignSessionId = seed.bookings.find(
      (booking) =>
        booking.memberId !== member.id &&
        futureSessionIds.has(booking.sessionId) &&
        booking.sessionId !== ownSessionId &&
        !seed.bookings.some((b) => b.memberId === member.id && b.sessionId === booking.sessionId),
    )?.sessionId;

    const res = await GET(
      new Request("http://localhost/api/ical/tok"),
      params(member.calendarToken),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/calendar/);
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain(ownSessionId);
    if (foreignSessionId) expect(body).not.toContain(foreignSessionId);
  });

  it("404s for an unknown token", async () => {
    const res = await GET(new Request("http://localhost/api/ical/tok"), params("does-not-exist"));
    expect(res.status).toBe(404);
  });

  it("404s for an empty token", async () => {
    const res = await GET(new Request("http://localhost/api/ical/tok"), params(""));
    expect(res.status).toBe(404);
  });
});
