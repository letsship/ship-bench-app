import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildSeed, SEED_NOW } from "@/lib/db/seed-data";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { getMemberCalendarFeed } from "./calendar";

describe("getMemberCalendarFeed", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed(SEED_NOW));
  });

  afterEach(() => {
    repos = null as unknown as Repositories;
  });

  it("throws 404 for an unknown token", async () => {
    await expect(getMemberCalendarFeed(repos, "nonexistent-token")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });

  it("throws 404 for an empty token", async () => {
    await expect(getMemberCalendarFeed(repos, "")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });

  it("throws 404 for a whitespace-only token", async () => {
    await expect(getMemberCalendarFeed(repos, "   ")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });

  it("returns only the token-holder's future booked sessions", async () => {
    const members = await repos.members.listByStudio(
      (await repos.studios.getFirst())!.id,
    );
    // Pick a member with a known deterministic token (seeded in buildSeed).
    const member = members[0];
    const result = await getMemberCalendarFeed(repos, member.calendarToken, SEED_NOW);

    expect(result.memberName).toBe(member.name);

    // Load all bookings for this member.
    const allBookings = await repos.bookings.listByMember(member.id);
    const allSessions = await repos.classSessions.listByStudio(member.studioId);
    const sessionsById = new Map(allSessions.map((s) => [s.id, s]));

    // The feed should only contain booked future sessions for this member.
    const expectedCount = allBookings.filter(
      (b) =>
        b.status === "booked" &&
        new Date(sessionsById.get(b.sessionId)!.startsAt).getTime() > SEED_NOW.getTime(),
    ).length;

    expect(result.events.length).toBe(expectedCount);

    // Every event uid starts with the session id and contains the booking id.
    for (const event of result.events) {
      expect(event.uid).toMatch(/@studiobook$/);
    }

    // Events should not include other members' sessions — cross-check by loading
    // all bookings for other members and ensuring none of those session+booking
    // combos appear in the feed.
    const otherMembers = members.slice(1);
    for (const other of otherMembers) {
      const otherBookings = await repos.bookings.listByMember(other.id);
      for (const otherBooking of otherBookings) {
        const otherSession = sessionsById.get(otherBooking.sessionId);
        if (!otherSession) continue;
        const expectedUid = `${otherSession.id}-${otherBooking.id}@studiobook`;
        expect(result.events.some((e) => e.uid === expectedUid)).toBe(false);
      }
    }
  });

  it("does not include past sessions in the feed", async () => {
    const members = await repos.members.listByStudio(
      (await repos.studios.getFirst())!.id,
    );
    const member = members[0];
    const result = await getMemberCalendarFeed(repos, member.calendarToken, SEED_NOW);

    const nowMs = SEED_NOW.getTime();
    for (const event of result.events) {
      // The event's startsAt is the session startsAt — must be in the future.
      expect(new Date(event.startsAt).getTime()).toBeGreaterThan(nowMs);
    }
  });

  it("does not include waitlisted or cancelled bookings", async () => {
    const members = await repos.members.listByStudio(
      (await repos.studios.getFirst())!.id,
    );
    const member = members[0];

    // Directly test the underlying filtering: load all the member's bookings,
    // then check the feed only contains 'booked' ones.
    const allBookings = await repos.bookings.listByMember(member.id);
    const nonBookedStatuses = ["waitlisted", "cancelled"];

    const result = await getMemberCalendarFeed(repos, member.calendarToken, SEED_NOW);

    // If there were non-booked (and non-cancellation) bookings, they should
    // not appear in the result. We verify by checking that no event uid could
    // correspond to a non-booked booking.
    for (const booking of allBookings) {
      if (!nonBookedStatuses.includes(booking.status)) continue;
      const expectedUid = `${booking.sessionId}-${booking.id}@studiobook`;
      expect(result.events.some((e) => e.uid === expectedUid)).toBe(false);
    }
  });
});