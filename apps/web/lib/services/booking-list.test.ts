import { describe, expect, it, vi } from "vitest";
import { createInMemoryRepositories, type SeedData } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type {
  Booking,
  ClassSession,
  ClassType,
  Member,
  Studio,
  StudioSettings,
} from "@/lib/db/types";
import { listBookingRows } from "@/lib/services/booking-list";

const NOW = new Date("2026-03-15T12:00:00.000Z");

function buildTestSeed(memberCount: number, sessionCount: number): SeedData {
  const studio: Studio = {
    id: "studio-1",
    name: "Test Studio",
    slug: "test-studio",
    timezone: "Europe/Amsterdam",
    createdAt: NOW.toISOString(),
  };
  const settings: StudioSettings = {
    studioId: studio.id,
    currency: "EUR",
    taxRateBps: 0,
    cancellationWindowHours: 12,
    waitlistEnabled: true,
    notifyBookingConfirmations: true,
    notifyCancellations: true,
    notifyWaitlistPromotions: true,
    notifyInvoices: true,
  };
  const members: Member[] = Array.from({ length: memberCount }, (_, i) => ({
    id: `member-${i}`,
    studioId: studio.id,
    name: `Member ${i}`,
    email: `member${i}@example.com`,
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: NOW.toISOString(),
  }));
  const classType: ClassType = {
    id: "class-type-1",
    studioId: studio.id,
    name: "Vinyasa Flow",
    description: null,
    color: "#5b8c5a",
    defaultCapacity: 100,
    defaultPriceCents: 1800,
    createdAt: NOW.toISOString(),
  };
  const sessions: ClassSession[] = Array.from({ length: sessionCount }, (_, i) => ({
    id: `session-${i}`,
    studioId: studio.id,
    classTypeId: classType.id,
    instructor: "Noor",
    startsAt: new Date(NOW.getTime() + i * 3_600_000).toISOString(),
    endsAt: new Date(NOW.getTime() + (i + 1) * 3_600_000).toISOString(),
    capacity: 100,
    priceCents: 1800,
    status: "scheduled",
    createdAt: NOW.toISOString(),
  }));
  const bookings: Booking[] = sessions.map((session, i) => ({
    id: `booking-${i}`,
    sessionId: session.id,
    memberId: members[i % members.length].id,
    status: "booked",
    bookedAt: NOW.toISOString(),
    cancelledAt: null,
  }));
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

function withCallCounts(repos: Repositories): {
  repos: Repositories;
  counts: Record<string, number>;
} {
  const counts: Record<string, number> = {
    "members.listByStudio": 0,
    "classSessions.listByStudio": 0,
    "classTypes.listByStudio": 0,
    "bookings.listBySessionIds": 0,
  };
  const spiedRepos: Repositories = {
    ...repos,
    members: {
      ...repos.members,
      listByStudio: vi.fn((...args: Parameters<Repositories["members"]["listByStudio"]>) => {
        counts["members.listByStudio"] += 1;
        return repos.members.listByStudio(...args);
      }),
    },
    classSessions: {
      ...repos.classSessions,
      listByStudio: vi.fn((...args: Parameters<Repositories["classSessions"]["listByStudio"]>) => {
        counts["classSessions.listByStudio"] += 1;
        return repos.classSessions.listByStudio(...args);
      }),
    },
    classTypes: {
      ...repos.classTypes,
      listByStudio: vi.fn((...args: Parameters<Repositories["classTypes"]["listByStudio"]>) => {
        counts["classTypes.listByStudio"] += 1;
        return repos.classTypes.listByStudio(...args);
      }),
    },
    bookings: {
      ...repos.bookings,
      listBySessionIds: vi.fn(
        (...args: Parameters<Repositories["bookings"]["listBySessionIds"]>) => {
          counts["bookings.listBySessionIds"] += 1;
          return repos.bookings.listBySessionIds(...args);
        },
      ),
    },
  };
  return { repos: spiedRepos, counts };
}

describe("listBookingRows", () => {
  it("issues a fixed number of repository reads regardless of booking count", async () => {
    const small = withCallCounts(createInMemoryRepositories(buildTestSeed(5, 10)));
    const large = withCallCounts(createInMemoryRepositories(buildTestSeed(50, 500)));

    const smallRows = await listBookingRows(small.repos, "studio-1");
    const largeRows = await listBookingRows(large.repos, "studio-1");

    expect(smallRows).toHaveLength(10);
    expect(largeRows).toHaveLength(500);

    expect(small.counts).toEqual(large.counts);
    for (const count of Object.values(small.counts)) {
      expect(count).toBe(1);
    }
  });

  it("joins each booking to its member, session, and class type", async () => {
    const seed = buildTestSeed(3, 3);
    const repos = createInMemoryRepositories(seed);
    const rows = await listBookingRows(repos, "studio-1");
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.memberName).not.toBe("—");
      expect(row.className).toBe("Vinyasa Flow");
      expect(row.instructor).toBe("Noor");
    }
    const sorted = [...rows].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    expect(rows).toEqual(sorted);
  });
});
