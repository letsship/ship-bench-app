import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member, Studio, StudioSettings } from "@/lib/db/types";
import { listBookingRows, type BookingRow } from "./booking-list";

// Regression guard for the bookings-list N+1 (stb-988). The list must batch-load
// member / class-session / class-type data so the number of repository reads
// stays bounded regardless of how many bookings are returned — no per-booking
// `getById` lookups. It also pins the row shape / fields / ordering.

const NOW = new Date("2026-07-01T12:00:00.000Z");
const ISO = NOW.toISOString();

const studio: Studio = {
  id: "s1",
  name: "Riverbank",
  slug: "riverbank",
  timezone: "Europe/Amsterdam",
  createdAt: ISO,
};
const settings: StudioSettings = {
  studioId: "s1",
  currency: "EUR",
  taxRateBps: 900,
  cancellationWindowHours: 12,
  waitlistEnabled: true,
  notifyBookingConfirmations: true,
  notifyCancellations: true,
  notifyWaitlistPromotions: true,
  notifyInvoices: true,
};

const classType: ClassType = {
  id: "ct1",
  studioId: "s1",
  name: "Vinyasa Flow",
  description: null,
  color: "#5b8c5a",
  defaultCapacity: 16,
  defaultPriceCents: 1800,
  createdAt: ISO,
};

function member(id: string): Member {
  return {
    id,
    studioId: "s1",
    name: `Member ${id}`,
    email: `${id}@e.co`,
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: ISO,
  };
}

// Build a seed with `n` distinct sessions (each its own day so ordering is
// deterministic) and exactly one booking per session, so listBookingRows returns
// exactly `n` rows.
function seedWithNBookings(n: number): SeedData {
  const members: Member[] = Array.from({ length: Math.min(n, 8) }, (_, i) => member(`m${i + 1}`));
  const sessions: ClassSession[] = [];
  const bookings: Booking[] = [];
  for (let i = 0; i < n; i += 1) {
    const sessionId = `cs${i + 1}`;
    const day = new Date(Date.UTC(2026, 6, 1 + i, 9)).toISOString();
    sessions.push({
      id: sessionId,
      studioId: "s1",
      classTypeId: "ct1",
      instructor: "Noor",
      startsAt: day,
      endsAt: new Date(Date.UTC(2026, 6, 1 + i, 10)).toISOString(),
      capacity: 16,
      priceCents: 1800,
      status: "scheduled",
      createdAt: ISO,
    });
    bookings.push({
      id: `b${i + 1}`,
      sessionId,
      memberId: members[i % members.length].id,
      status: "booked",
      bookedAt: ISO,
      cancelledAt: null,
    });
  }
  return {
    studio,
    settings,
    members,
    classTypes: [classType],
    sessions,
    bookings,
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

interface Counts {
  membersGetById: number;
  classSessionsGetById: number;
  classTypesGetById: number;
  membersListByStudio: number;
  classSessionsListByStudio: number;
  classTypesListByStudio: number;
  bookingsListBySessionIds: number;
}

// Wrap a Repositories instance so the per-booking and batch read methods record
// call counts. No production-code seam is needed for spying.
function wrapWithCounters(repos: Repositories): { repos: Repositories; counts: Counts } {
  const counts: Counts = {
    membersGetById: 0,
    classSessionsGetById: 0,
    classTypesGetById: 0,
    membersListByStudio: 0,
    classSessionsListByStudio: 0,
    classTypesListByStudio: 0,
    bookingsListBySessionIds: 0,
  };
  const membersGetById = repos.members.getById.bind(repos.members);
  const classSessionsGetById = repos.classSessions.getById.bind(repos.classSessions);
  const classTypesGetById = repos.classTypes.getById.bind(repos.classTypes);
  const membersListByStudio = repos.members.listByStudio.bind(repos.members);
  const classSessionsListByStudio = repos.classSessions.listByStudio.bind(repos.classSessions);
  const classTypesListByStudio = repos.classTypes.listByStudio.bind(repos.classTypes);
  const bookingsListBySessionIds = repos.bookings.listBySessionIds.bind(repos.bookings);

  const wrapped: Repositories = {
    ...repos,
    members: {
      ...repos.members,
      async getById(id: string) {
        counts.membersGetById += 1;
        return membersGetById(id);
      },
      async listByStudio(studioId: string) {
        counts.membersListByStudio += 1;
        return membersListByStudio(studioId);
      },
    },
    classSessions: {
      ...repos.classSessions,
      async getById(id: string) {
        counts.classSessionsGetById += 1;
        return classSessionsGetById(id);
      },
      async listByStudio(studioId: string, range = {}) {
        counts.classSessionsListByStudio += 1;
        return classSessionsListByStudio(studioId, range);
      },
    },
    classTypes: {
      ...repos.classTypes,
      async getById(id: string) {
        counts.classTypesGetById += 1;
        return classTypesGetById(id);
      },
      async listByStudio(studioId: string) {
        counts.classTypesListByStudio += 1;
        return classTypesListByStudio(studioId);
      },
    },
    bookings: {
      ...repos.bookings,
      async listBySessionIds(sessionIds: string[]) {
        counts.bookingsListBySessionIds += 1;
        return bookingsListBySessionIds(sessionIds);
      },
    },
  };
  return { repos: wrapped, counts };
}

describe("listBookingRows — N+1 regression guard", () => {
  it("returns rows with the exact BookingRow shape, joined fields, and startsAt order", async () => {
    const base = createInMemoryRepositories(seedWithNBookings(3));
    const rows = await listBookingRows(base, "s1");

    expect(rows).toHaveLength(3);
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
    // Joined fields resolve from the batch-loaded maps.
    expect(rows[0]).toMatchObject({
      memberName: "Member m1",
      className: "Vinyasa Flow",
      classColor: "#5b8c5a",
      instructor: "Noor",
      status: "booked",
    });
    // Rows are ordered by startsAt ascending.
    const starts = rows.map((r) => r.startsAt);
    expect([...starts].sort((a, b) => a.localeCompare(b))).toEqual(starts);
  });

  it("falls back to the documented placeholders for unknown member / class type", async () => {
    // Booking references a member and (via session) a class type that don't
    // belong to this studio — the join must degrade gracefully to the same
    // fallbacks the endpoint returns today, not throw.
    const seed = seedWithNBookings(1);
    // Booking references a member outside this studio, and the session references
    // a class type that does not exist for this studio — the join must degrade
    // gracefully to the same fallbacks the endpoint returns today, not throw.
    seed.bookings[0].memberId = "member-from-another-studio";
    seed.sessions[0].classTypeId = "class-type-from-another-studio";
    const rows = await listBookingRows(createInMemoryRepositories(seed), "s1");
    expect(rows).toHaveLength(1);
    expect(rows[0].memberName).toBe("—");
    expect(rows[0].className).toBe("Class");
    expect(rows[0].classColor).toBe("#6b7280");
  });

  it("does not read members / classSessions / classTypes once per booking (bounded reads)", async () => {
    const small = 3;
    const large = 60;

    const { repos: smallRepos, counts: smallCounts } = wrapWithCounters(
      createInMemoryRepositories(seedWithNBookings(small)),
    );
    const smallRows: BookingRow[] = await listBookingRows(smallRepos, "s1");

    const { repos: largeRepos, counts: largeCounts } = wrapWithCounters(
      createInMemoryRepositories(seedWithNBookings(large)),
    );
    const largeRows: BookingRow[] = await listBookingRows(largeRepos, "s1");

    expect(smallRows).toHaveLength(small);
    expect(largeRows).toHaveLength(large);

    // Per-booking getById lookups must never happen — these are the N+1.
    expect(smallCounts.membersGetById).toBe(0);
    expect(largeCounts.membersGetById).toBe(0);
    expect(smallCounts.classSessionsGetById).toBe(0);
    expect(largeCounts.classSessionsGetById).toBe(0);
    expect(smallCounts.classTypesGetById).toBe(0);
    expect(largeCounts.classTypesGetById).toBe(0);

    // The studio-level batch reads stay constant regardless of N.
    expect(smallCounts.membersListByStudio).toBe(1);
    expect(largeCounts.membersListByStudio).toBe(1);
    expect(smallCounts.classSessionsListByStudio).toBe(1);
    expect(largeCounts.classSessionsListByStudio).toBe(1);
    expect(smallCounts.classTypesListByStudio).toBe(1);
    expect(largeCounts.classTypesListByStudio).toBe(1);
    expect(smallCounts.bookingsListBySessionIds).toBe(1);
    expect(largeCounts.bookingsListBySessionIds).toBe(1);
  });
});
