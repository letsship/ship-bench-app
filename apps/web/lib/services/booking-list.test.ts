import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { listBookingRows } from "./booking-list";

const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

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
  sessionId: string,
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

interface CallCounter {
  listByStudio: number;
  getById: number;
}

function createCountingProxy<T extends Record<string, unknown>>(repo: T, counter: CallCounter): T {
  return new Proxy(repo, {
    get(target, prop) {
      const original = target[prop as keyof T];
      if (typeof original !== "function") return original;
      return function (...args: unknown[]) {
        if (prop === "listByStudio") counter.listByStudio++;
        if (prop === "getById") counter.getById++;
        return (original as (...args: unknown[]) => unknown).apply(target, args);
      };
    },
  }) as T;
}

describe("booking list N+1 regression", () => {
  it("reads a bounded number of members and sessions regardless of booking count", async () => {
    // Small bookings set
    const smallMembers = Array.from({ length: 5 }, (_, i) => member(`m${i}`));
    const smallSessions = Array.from({ length: 5 }, (_, i) =>
      session(`cs${i}`, { startsAt: FUTURE }),
    );
    const smallBookings = Array.from({ length: 5 }, (_, i) =>
      booking(`b${i}`, `m${i % smallMembers.length}`, `cs${i % smallSessions.length}`),
    );

    const smallSeed: SeedData = {
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
      members: smallMembers,
      classTypes: [classType("ct1")],
      sessions: smallSessions,
      bookings: smallBookings,
      invoices: [],
      lineItems: [],
      outbox: [],
    };

    const smallRepos = createInMemoryRepositories(smallSeed);
    const smallMembersCounter: CallCounter = { listByStudio: 0, getById: 0 };
    const smallSessionsCounter: CallCounter = { listByStudio: 0, getById: 0 };
    smallRepos.members = createCountingProxy(smallRepos.members, smallMembersCounter);
    smallRepos.classSessions = createCountingProxy(smallRepos.classSessions, smallSessionsCounter);

    const smallRows = await listBookingRows(smallRepos, "s1");

    // Large bookings set
    const largeMembers = Array.from({ length: 200 }, (_, i) => member(`m${i}`));
    const largeSessions = Array.from({ length: 100 }, (_, i) =>
      session(`cs${i}`, { startsAt: FUTURE }),
    );
    const largeBookings = Array.from({ length: 500 }, (_, i) =>
      booking(`b${i}`, `m${i % largeMembers.length}`, `cs${i % largeSessions.length}`),
    );

    const largeSeed: SeedData = {
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
      members: largeMembers,
      classTypes: [classType("ct1")],
      sessions: largeSessions,
      bookings: largeBookings,
      invoices: [],
      lineItems: [],
      outbox: [],
    };

    const largeRepos = createInMemoryRepositories(largeSeed);
    const largeMembersCounter: CallCounter = { listByStudio: 0, getById: 0 };
    const largeSessionsCounter: CallCounter = { listByStudio: 0, getById: 0 };
    largeRepos.members = createCountingProxy(largeRepos.members, largeMembersCounter);
    largeRepos.classSessions = createCountingProxy(largeRepos.classSessions, largeSessionsCounter);

    const largeRows = await listBookingRows(largeRepos, "s1");

    // Assert read counts are constant across both runs
    expect(smallMembersCounter.listByStudio).toBe(1);
    expect(smallMembersCounter.getById).toBe(0);
    expect(smallSessionsCounter.listByStudio).toBe(1);
    expect(smallSessionsCounter.getById).toBe(0);

    expect(largeMembersCounter.listByStudio).toBe(smallMembersCounter.listByStudio);
    expect(largeMembersCounter.getById).toBe(smallMembersCounter.getById);
    expect(largeSessionsCounter.listByStudio).toBe(smallSessionsCounter.listByStudio);
    expect(largeSessionsCounter.getById).toBe(smallSessionsCounter.getById);

    // Assert returned rows have the expected shape
    expect(smallRows[0]).toHaveProperty("id");
    expect(smallRows[0]).toHaveProperty("memberName");
    expect(smallRows[0]).toHaveProperty("className");
    expect(smallRows[0]).toHaveProperty("classColor");
    expect(smallRows[0]).toHaveProperty("instructor");
    expect(smallRows[0]).toHaveProperty("startsAt");
    expect(smallRows[0]).toHaveProperty("status");

    expect(largeRows[0]).toHaveProperty("id");
    expect(largeRows[0]).toHaveProperty("memberName");
    expect(largeRows[0]).toHaveProperty("className");
    expect(largeRows[0]).toHaveProperty("classColor");
    expect(largeRows[0]).toHaveProperty("instructor");
    expect(largeRows[0]).toHaveProperty("startsAt");
    expect(largeRows[0]).toHaveProperty("status");

    // Assert rows are sorted by startsAt
    for (let i = 1; i < smallRows.length; i++) {
      expect(smallRows[i].startsAt.localeCompare(smallRows[i - 1].startsAt)).toBeGreaterThanOrEqual(
        0,
      );
    }
    for (let i = 1; i < largeRows.length; i++) {
      expect(largeRows[i].startsAt.localeCompare(largeRows[i - 1].startsAt)).toBeGreaterThanOrEqual(
        0,
      );
    }
  });
});
