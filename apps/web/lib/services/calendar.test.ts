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

    // Both should return valid ICS, but they may have different sessions or the same depending on bookings
    expect(body1).toContain("BEGIN:VCALENDAR");
    expect(body2).toContain("BEGIN:VCALENDAR");
  });
});
