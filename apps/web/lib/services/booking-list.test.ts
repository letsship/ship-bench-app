import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { listBookingRows } from "./booking-list";

const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

function baseSeed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: ISO },
    settings: {
      studioId: "s1",
      currency: "EUR",
      taxRateBps: 900,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
    members: [],
    classTypes: [],
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

const member = (id: string, over: Partial<Member> = {}): Member => ({
  id,
  studioId: "s1",
  name: id,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
  ...over,
});

const classType = (id: string): ClassType => ({
  id,
  studioId: "s1",
  name: "Yoga",
  description: null,
  color: "#111111",
  defaultCapacity: 10,
  defaultPriceCents: 1000,
  createdAt: ISO,
});

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "I",
  startsAt: FUTURE,
  endsAt: FUTURE_END,
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: ISO,
  ...over,
});

const booking = (
  id: string,
  memberId: string,
  sessionId: string = "cs1",
  over: Partial<Booking> = {},
): Booking => ({
  id,
  sessionId,
  memberId,
  status: "booked",
  bookedAt: ISO,
  cancelledAt: null,
  ...over,
});

interface ReadCounts {
  members: number;
  classSessions: number;
}

function createCountingRepositories(seed: SeedData): [Repositories, () => ReadCounts] {
  const repos = createInMemoryRepositories(seed);
  const readCounts: ReadCounts = { members: 0, classSessions: 0 };

  const originalMembers = repos.members;
  repos.members = {
    ...originalMembers,
    listByStudio: async (...args) => {
      readCounts.members++;
      return originalMembers.listByStudio(...args);
    },
  };

  const originalSessions = repos.classSessions;
  repos.classSessions = {
    ...originalSessions,
    listByStudio: async (...args) => {
      readCounts.classSessions++;
      return originalSessions.listByStudio(...args);
    },
  };

  return [repos, () => ({ ...readCounts })];
}

describe("booking-list N+1 prevention", () => {
  it("lists bookings with bounded reads regardless of booking count", async () => {
    const classTypesCt1 = [classType("ct1")];

    // Seed with few bookings (3)
    const smallMembers = [member("m1"), member("m2"), member("m3")];
    const smallSessions = [
      session("cs1", { classTypeId: "ct1", startsAt: FUTURE }),
      session("cs2", {
        classTypeId: "ct2",
        startsAt: new Date(NOW.getTime() + 8 * 86_400_000).toISOString(),
      }),
      session("cs3", {
        classTypeId: "ct1",
        startsAt: new Date(NOW.getTime() + 9 * 86_400_000).toISOString(),
      }),
    ];
    const smallBookings = [
      booking("b1", "m1", "cs1"),
      booking("b2", "m2", "cs2"),
      booking("b3", "m3", "cs3"),
    ];

    const [smallRepos, getSmallCounts] = createCountingRepositories(
      baseSeed({
        members: smallMembers,
        classTypes: classTypesCt1,
        sessions: smallSessions,
        bookings: smallBookings,
      }),
    );

    const smallRows = await listBookingRows(smallRepos, "s1");
    const smallCounts = getSmallCounts();

    // Seed with many bookings (60)
    const largeMembers = Array.from({ length: 60 }, (_, i) => member(`m${i + 1}`));
    const largeSessions = [
      session("cs1", { classTypeId: "ct1", startsAt: FUTURE }),
      session("cs2", {
        classTypeId: "ct2",
        startsAt: new Date(NOW.getTime() + 8 * 86_400_000).toISOString(),
      }),
      session("cs3", {
        classTypeId: "ct1",
        startsAt: new Date(NOW.getTime() + 9 * 86_400_000).toISOString(),
      }),
    ];
    const largeBookings = Array.from({ length: 60 }, (_, i) => {
      const sessionId = ["cs1", "cs2", "cs3"][i % 3];
      return booking(`b${i + 1}`, `m${i + 1}`, sessionId);
    });

    const [largeRepos, getLargeCounts] = createCountingRepositories(
      baseSeed({
        members: largeMembers,
        classTypes: classTypesCt1,
        sessions: largeSessions,
        bookings: largeBookings,
      }),
    );

    const largeRows = await listBookingRows(largeRepos, "s1");
    const largeCounts = getLargeCounts();

    // Assert read counts are equal (small and independent of N)
    expect(smallCounts.members).toBe(1);
    expect(smallCounts.classSessions).toBe(1);
    expect(smallCounts.members).toBe(largeCounts.members);
    expect(smallCounts.classSessions).toBe(largeCounts.classSessions);

    // Assert output for small set
    expect(smallRows).toHaveLength(3);
    expect(smallRows[0]).toMatchObject({
      id: "b1",
      memberName: "m1",
      className: "Yoga",
      classColor: "#111111",
      instructor: "I",
      status: "booked",
    });

    // Assert output for large set
    expect(largeRows).toHaveLength(60);
  });

  it("uses fallback values for missing members", async () => {
    const [repos] = createCountingRepositories(
      baseSeed({
        members: [member("m1")],
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        bookings: [booking("b1", "m1", "cs1"), booking("b2", "missing-member", "cs1")],
      }),
    );

    const rows = await listBookingRows(repos, "s1");

    expect(rows).toHaveLength(2);
    expect(rows[0].memberName).toBe("m1");
    expect(rows[1].memberName).toBe("—");
    expect(rows[1].className).toBe("Yoga");
    expect(rows[1].classColor).toBe("#111111");
  });
});
