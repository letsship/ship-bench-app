import { describe, expect, it, vi } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import { newId } from "@/lib/db/ids";
import type { Booking, ClassSession } from "@/lib/db/types";
import { listBookingRows } from "./booking-list";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// Appends many more sessions (spread across the existing class types) and
// several bookings per session (spread across the existing members) so the
// booking count grows well beyond the baseline seed, without touching how
// many distinct members/class types exist.
function withManyBookings(base: SeedData, extraSessionCount: number): SeedData {
  const studioId = base.studio.id;
  const sessions: ClassSession[] = [];
  const bookings: Booking[] = [...base.bookings];
  for (let i = 0; i < extraSessionCount; i += 1) {
    const classType = base.classTypes[i % base.classTypes.length];
    const session: ClassSession = {
      id: newId(),
      studioId,
      classTypeId: classType.id,
      instructor: `Instructor ${i % 5}`,
      startsAt: new Date(NOW.getTime() + i * 3_600_000).toISOString(),
      endsAt: new Date(NOW.getTime() + i * 3_600_000 + 1_800_000).toISOString(),
      capacity: classType.defaultCapacity,
      priceCents: classType.defaultPriceCents,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    };
    sessions.push(session);
    for (const member of base.members) {
      bookings.push({
        id: newId(),
        sessionId: session.id,
        memberId: member.id,
        status: "booked",
        bookedAt: NOW.toISOString(),
        cancelledAt: null,
      });
    }
  }
  return { ...base, sessions: [...base.sessions, ...sessions], bookings };
}

function spyOnStudioReads(repos: Repositories) {
  const membersSpy = vi.spyOn(repos.members, "listByStudio");
  const sessionsSpy = vi.spyOn(repos.classSessions, "listByStudio");
  return { membersSpy, sessionsSpy };
}

describe("listBookingRows", () => {
  it("issues a fixed number of member and class-session reads regardless of booking count", async () => {
    const smallSeed = buildSeed(NOW);
    const smallRepos = createInMemoryRepositories(smallSeed);
    const studioId = smallSeed.studio.id;
    const { membersSpy: smallMembersSpy, sessionsSpy: smallSessionsSpy } =
      spyOnStudioReads(smallRepos);

    const smallRows = await listBookingRows(smallRepos, studioId);
    expect(smallMembersSpy).toHaveBeenCalledTimes(1);
    expect(smallSessionsSpy).toHaveBeenCalledTimes(1);

    const largeSeed = withManyBookings(smallSeed, 200);
    const largeRepos = createInMemoryRepositories(largeSeed);
    const { membersSpy: largeMembersSpy, sessionsSpy: largeSessionsSpy } =
      spyOnStudioReads(largeRepos);

    const largeRows = await listBookingRows(largeRepos, studioId);
    expect(largeMembersSpy).toHaveBeenCalledTimes(1);
    expect(largeSessionsSpy).toHaveBeenCalledTimes(1);

    // The larger seed has strictly more bookings, yet the read count above did
    // not grow — this is the invariant the issue asked us to protect.
    expect(largeRows.length).toBeGreaterThan(smallRows.length);
  });

  it("returns rows with the expected shape, ordered by session start", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const studioId = seed.studio.id;

    const rows = await listBookingRows(repos, studioId);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          memberName: expect.any(String),
          className: expect.any(String),
          classColor: expect.any(String),
          instructor: expect.any(String),
          startsAt: expect.any(String),
          status: expect.any(String),
        }),
      );
    }
    const startsAtValues = rows.map((row) => row.startsAt);
    const sorted = [...startsAtValues].sort((a, b) => a.localeCompare(b));
    expect(startsAtValues).toEqual(sorted);
  });
});
