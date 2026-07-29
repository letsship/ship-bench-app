import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import { HttpError } from "@/lib/http";
import { getMemberCalendar } from "./calendar";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// Member 0 in the seed (Amara Okafor) is given the deterministic token
// `cal-tok-0001` — see buildMembers in lib/db/seed-data.ts.
const AMARA_TOKEN = "cal-tok-0001";

describe("getMemberCalendar", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed(NOW));
  });

  async function expectedEvents(memberId: string) {
    const bookings = (await repos.bookings.listByMember(memberId)).filter(
      (b) => b.status === "booked",
    );
    const sessions = await Promise.all(
      bookings.map((b) => repos.classSessions.getById(b.sessionId)),
    );
    const events = [];
    for (const session of sessions) {
      if (!session) continue;
      if (new Date(session.startsAt).getTime() <= NOW.getTime()) continue;
      const classType = await repos.classTypes.getById(session.classTypeId);
      events.push({
        uid: `${session.id}@studiobook`,
        title: classType?.name ?? "Class",
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        description: `Instructor: ${session.instructor}`,
      });
    }
    events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return events;
  }

  it("throws a 404 HttpError for an empty/whitespace token", async () => {
    await expect(getMemberCalendar(repos, "")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
    await expect(getMemberCalendar(repos, "   ")).rejects.toBeInstanceOf(HttpError);
  });

  it("throws a 404 HttpError for an unknown token", async () => {
    await expect(getMemberCalendar(repos, "does-not-exist")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });

  it("resolves a known token to that member", async () => {
    const { member } = await getMemberCalendar(repos, AMARA_TOKEN, NOW);
    expect(member.calendarToken).toBe(AMARA_TOKEN);
    expect(member.name).toBe("Amara Okafor");
  });

  it("returns only the member's upcoming, confirmed-seat sessions", async () => {
    const { member, events } = await getMemberCalendar(repos, AMARA_TOKEN, NOW);
    const expected = await expectedEvents(member.id);
    expect(events).toEqual(expected);
  });

  it("excludes past sessions", async () => {
    const { events } = await getMemberCalendar(repos, AMARA_TOKEN, NOW);
    for (const event of events) {
      expect(new Date(event.startsAt).getTime()).toBeGreaterThan(NOW.getTime());
    }
  });

  it("excludes sessions the member is not booked into (cross-member isolation)", async () => {
    const { member, events } = await getMemberCalendar(repos, AMARA_TOKEN, NOW);
    const memberSessionIds = new Set(
      (await repos.bookings.listByMember(member.id))
        .filter((b) => b.status === "booked")
        .map((b) => b.sessionId),
    );
    // No event for a session the member does not hold a confirmed seat in.
    for (const event of events) {
      const sessionId = event.uid.replace(/@studiobook$/, "");
      expect(memberSessionIds.has(sessionId)).toBe(true);
    }
    // And the feed is a strict subset of all upcoming sessions (others exist).
    const studio = await repos.studios.getFirst();
    const allUpcoming = (await repos.classSessions.listByStudio(studio!.id, {
      from: NOW.toISOString(),
    })).map((s) => s.id);
    const eventSessionIds = events.map((e) => e.uid.replace(/@studiobook$/, ""));
    expect(eventSessionIds.every((id) => allUpcoming.includes(id))).toBe(true);
    expect(eventSessionIds.length).toBeLessThan(allUpcoming.length);
  });

  it("excludes waitlisted and cancelled bookings", async () => {
    const { member } = await getMemberCalendar(repos, AMARA_TOKEN, NOW);
    // The seed fills one small upcoming session past capacity with waitlisted
    // bookings — none of those should surface for any member as a confirmed
    // seat. Verify by re-asserting every returned event maps to a `booked`
    // booking for the member.
    const memberBookings = await repos.bookings.listByMember(member.id);
    const bookedSessionIds = new Set(
      memberBookings.filter((b) => b.status === "booked").map((b) => b.sessionId),
    );
    const waitlistedOrCancelled = memberBookings.filter(
      (b) => b.status !== "booked",
    );
    // Sanity: the member has at least one non-confirmed booking somewhere in
    // the dataset (otherwise this assertion is vacuous).
    if (waitlistedOrCancelled.length === 0) {
      // Force a cancelled booking on an upcoming session and confirm it's
      // still excluded.
      const upcoming = (await repos.classSessions.listByStudio(member.studioId, {
        from: NOW.toISOString(),
      }))[0];
      await repos.bookings.insert({
        id: "bk_cancel",
        sessionId: upcoming.id,
        memberId: member.id,
        status: "cancelled",
        bookedAt: NOW.toISOString(),
        cancelledAt: NOW.toISOString(),
      });
    }
    const { events } = await getMemberCalendar(repos, AMARA_TOKEN, NOW);
    for (const event of events) {
      const sessionId = event.uid.replace(/@studiobook$/, "");
      expect(bookedSessionIds.has(sessionId)).toBe(true);
    }
  });
});
