import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
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

const member = (id: string): Member => ({
  id,
  studioId: "s1",
  name: id,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
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

const booking = (id: string, memberId: string, over: Partial<Booking> = {}): Booking => ({
  id,
  sessionId: "cs1",
  memberId,
  status: "booked",
  bookedAt: ISO,
  cancelledAt: null,
  ...over,
});

// Wrap a repository to count method calls
function createCountingProxy<T extends object>(
  repo: T,
): {
  proxy: T;
  counts: Record<string, number>;
} {
  const counts: Record<string, number> = {};

  return {
    counts,
    proxy: new Proxy(repo as Record<PropertyKey, unknown>, {
      get(target, prop) {
        const original = target[prop];
        if (typeof original === "function") {
          return function (...args: unknown[]) {
            const key = String(prop);
            counts[key] = (counts[key] ?? 0) + 1;
            return (original as (...args: unknown[]) => unknown).apply(target, args);
          };
        }
        return original;
      },
    }) as T,
  };
}

describe("booking list N+1 regression", () => {
  it("does not grow repository reads with booking count", async () => {
    // Create two scenarios: 1 booking and 50 bookings, same join graph
    // (both pointing to same members/sessions/class types)
    const session1 = session("cs1");
    const session2 = session("cs2", {
      startsAt: new Date(new Date(FUTURE).getTime() + 3600000).toISOString(),
    });
    const sessions = [session1, session2];
    const members = [member("m1"), member("m2"), member("m3"), member("m4"), member("m5")];
    const classTypes = [classType("ct1")];

    // Small scenario: 1 booking
    const smallBookings = [booking("b1", "m1", { sessionId: "cs1" })];

    // Large scenario: 50 bookings spread across members and sessions
    const largeBookings = Array.from({ length: 50 }, (_, i) => {
      const memberId = members[i % members.length].id;
      const sessionId = sessions[i % sessions.length].id;
      return booking(`b${i + 1}`, memberId, { sessionId });
    });

    // Run listBookingRows with small dataset and count reads
    const smallRepos = createInMemoryRepositories(
      baseSeed({
        classTypes,
        sessions,
        members,
        bookings: smallBookings,
      }),
    );

    const { proxy: smallMembersProxy, counts: smallMembersCounts } = createCountingProxy(
      smallRepos.members,
    );
    const { proxy: smallSessionsProxy, counts: smallSessionsCounts } = createCountingProxy(
      smallRepos.classSessions,
    );

    const smallReposWithProxy = {
      ...smallRepos,
      members: smallMembersProxy,
      classSessions: smallSessionsProxy,
    };

    const smallRows = await listBookingRows(smallReposWithProxy, "s1");

    // Run listBookingRows with large dataset and count reads
    const largeRepos = createInMemoryRepositories(
      baseSeed({
        classTypes,
        sessions,
        members,
        bookings: largeBookings,
      }),
    );

    const { proxy: largeMembersProxy, counts: largeMembersCounts } = createCountingProxy(
      largeRepos.members,
    );
    const { proxy: largeSessionsProxy, counts: largeSessionsCounts } = createCountingProxy(
      largeRepos.classSessions,
    );

    const largeReposWithProxy = {
      ...largeRepos,
      members: largeMembersProxy,
      classSessions: largeSessionsProxy,
    };

    const largeRows = await listBookingRows(largeReposWithProxy, "s1");

    // Assert read counts are the same and constant (not per-booking)
    expect(Object.values(smallMembersCounts).reduce((a, b) => a + b, 0)).toBe(
      Object.values(largeMembersCounts).reduce((a, b) => a + b, 0),
    );
    expect(Object.values(smallSessionsCounts).reduce((a, b) => a + b, 0)).toBe(
      Object.values(largeSessionsCounts).reduce((a, b) => a + b, 0),
    );

    // Assert row shape and ordering are preserved
    expect(smallRows.length).toBe(smallBookings.length);
    expect(largeRows.length).toBe(largeBookings.length);

    smallRows.forEach((row) => {
      expect(row).toHaveProperty("id");
      expect(row).toHaveProperty("memberName");
      expect(row).toHaveProperty("className");
      expect(row).toHaveProperty("classColor");
      expect(row).toHaveProperty("instructor");
      expect(row).toHaveProperty("startsAt");
      expect(row).toHaveProperty("status");
    });

    largeRows.forEach((row) => {
      expect(row).toHaveProperty("id");
      expect(row).toHaveProperty("memberName");
      expect(row).toHaveProperty("className");
      expect(row).toHaveProperty("classColor");
      expect(row).toHaveProperty("instructor");
      expect(row).toHaveProperty("startsAt");
      expect(row).toHaveProperty("status");
    });

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
