import { describe, it, expect } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed, SEED_NOW } from "@/lib/db/seed-data";
import { getMemberCalendarFeed } from "./members";

describe("getMemberCalendarFeed", () => {
  const nowTime = SEED_NOW.toISOString();

  it("returns only the token-holder's upcoming booked sessions", async () => {
    const seed = buildSeed(SEED_NOW);
    const repos = createInMemoryRepositories(seed);
    const tokenHolder = seed.members[0];

    const { member, events } = await getMemberCalendarFeed(
      repos,
      tokenHolder.calendarToken,
      nowTime,
    );

    expect(member.id).toBe(tokenHolder.id);
    expect(member.email).toBe(tokenHolder.email);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.uid).toContain("@studiobook");
      expect(event.title).toBeDefined();
      expect(event.startsAt).toBeDefined();
      expect(event.endsAt).toBeDefined();
    }
  });

  it("throws 404 for unknown token", async () => {
    const seed = buildSeed(SEED_NOW);
    const repos = createInMemoryRepositories(seed);

    await expect(getMemberCalendarFeed(repos, "unknown-token-12345", nowTime)).rejects.toThrow(
      "Calendar token not found",
    );
  });

  it("throws 404 for empty token", async () => {
    const seed = buildSeed(SEED_NOW);
    const repos = createInMemoryRepositories(seed);

    await expect(getMemberCalendarFeed(repos, "", nowTime)).rejects.toThrow(
      "Calendar token not found",
    );
  });

  it("throws 404 for whitespace-only token", async () => {
    const seed = buildSeed(SEED_NOW);
    const repos = createInMemoryRepositories(seed);

    await expect(getMemberCalendarFeed(repos, "   ", nowTime)).rejects.toThrow(
      "Calendar token not found",
    );
  });

  it("does not leak another member's schedule", async () => {
    const seed = buildSeed(SEED_NOW);
    const repos = createInMemoryRepositories(seed);
    const member1Token = seed.members[0].calendarToken;
    const member2Id = seed.members[1].id;

    const { events: member1Events } = await getMemberCalendarFeed(repos, member1Token, nowTime);

    for (const event of member1Events) {
      const sessionId = event.uid.split("@")[0];
      const bookings = seed.bookings.filter((b) => b.sessionId === sessionId);
      const member1Booking = bookings.find((b) => b.memberId === seed.members[0].id);
      const member2Booking = bookings.find((b) => b.memberId === member2Id);

      if (member2Booking) {
        expect(member1Booking).toBeDefined();
      }
    }
  });

  it("excludes past sessions", async () => {
    const seed = buildSeed(SEED_NOW);
    const repos = createInMemoryRepositories(seed);
    const tokenHolder = seed.members[0];

    const { events } = await getMemberCalendarFeed(repos, tokenHolder.calendarToken, nowTime);

    for (const event of events) {
      const eventTime = new Date(event.startsAt).getTime();
      const now = SEED_NOW.getTime();
      expect(eventTime).toBeGreaterThan(now);
    }
  });

  it("handles token with leading/trailing whitespace", async () => {
    const seed = buildSeed(SEED_NOW);
    const repos = createInMemoryRepositories(seed);
    const tokenHolder = seed.members[0];

    const { member } = await getMemberCalendarFeed(
      repos,
      `  ${tokenHolder.calendarToken}  `,
      nowTime,
    );

    expect(member.id).toBe(tokenHolder.id);
  });
});
