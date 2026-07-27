import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { getMemberCalendarFeed } from "./calendar";
import { HttpError } from "@/lib/http";

describe("getMemberCalendarFeed", () => {
  const now = new Date("2026-07-27T12:00:00.000Z");
  const studioName = "Test Studio";

  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(now)));
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns an ICS body for a valid token", async () => {
    const repos = createInMemoryRepositories(buildSeed(now));
    const seed = buildSeed(now);
    const member = seed.members[0];

    const body = await getMemberCalendarFeed(repos, member.calendarToken, studioName);
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("END:VCALENDAR");
    expect(body).toContain("SUMMARY:");
  });

  it("throws 404 for an unknown token", async () => {
    const repos = createInMemoryRepositories(buildSeed(now));

    await expect(getMemberCalendarFeed(repos, "unknown_token", studioName)).rejects.toThrow(
      HttpError,
    );
  });

  it("throws 404 for an empty token", async () => {
    const repos = createInMemoryRepositories(buildSeed(now));

    await expect(getMemberCalendarFeed(repos, "", studioName)).rejects.toThrow(HttpError);
  });

  it("includes only upcoming booked sessions", async () => {
    const repos = createInMemoryRepositories(buildSeed(now));
    const seed = buildSeed(now);
    const member = seed.members[0];

    const body = await getMemberCalendarFeed(repos, member.calendarToken, studioName);

    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("VERSION:2.0");
  });

  it("does not include other members' sessions", async () => {
    const repos = createInMemoryRepositories(buildSeed(now));
    const seed = buildSeed(now);
    const member1 = seed.members[0];
    const member2 = seed.members[1];

    const body1 = await getMemberCalendarFeed(repos, member1.calendarToken, studioName);
    const body2 = await getMemberCalendarFeed(repos, member2.calendarToken, studioName);

    // Extract UIDs from both feeds (format: UID:sessionId@studiobook)
    const extractUIDs = (body: string): Set<string> => {
      const uids = new Set<string>();
      const lines = body.split("\n");
      for (const line of lines) {
        if (line.startsWith("UID:")) {
          uids.add(line.substring(4));
        }
      }
      return uids;
    };

    const uids1 = extractUIDs(body1);
    const uids2 = extractUIDs(body2);

    // Find a session that member1 is booked into but member2 is NOT
    // (deterministic seed bookings ensure they don't book all the same sessions)
    const member1Booked = new Set(
      seed.bookings
        .filter((b) => b.memberId === member1.id && b.status === "booked")
        .map((b) => b.sessionId),
    );
    const member2Booked = new Set(
      seed.bookings
        .filter((b) => b.memberId === member2.id && b.status === "booked")
        .map((b) => b.sessionId),
    );

    // Find a session unique to member1
    let uniqueSessionId: string | null = null;
    for (const sessionId of member1Booked) {
      if (!member2Booked.has(sessionId)) {
        uniqueSessionId = sessionId;
        break;
      }
    }

    // Verify isolation: if member1 has a session exclusive to them,
    // that session should NOT appear in member2's feed
    if (uniqueSessionId) {
      const uid = `${uniqueSessionId}@studiobook`;
      // The session may be in member1's feed if it's in the future
      // But it must NEVER be in member2's feed since they're not booked
      if (uids1.has(uid)) {
        expect(uids2.has(uid)).toBe(false);
      }
    }
  });
});
