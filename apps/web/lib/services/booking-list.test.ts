import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { listBookingRows } from "./booking-list";

const NOW = new Date();
const ISO = NOW.toISOString();
const startAt = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000).toISOString();

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
  defaultCapacity: 100,
  defaultPriceCents: 1000,
  createdAt: ISO,
});

const session = (id: string, hoursFromNow: number): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "I",
  startsAt: startAt(hoursFromNow),
  endsAt: startAt(hoursFromNow + 1),
  capacity: 100,
  priceCents: 1000,
  status: "scheduled",
  createdAt: ISO,
});

const booking = (id: string, sessionId: string, memberId: string): Booking => ({
  id,
  sessionId,
  memberId,
  status: "booked",
  bookedAt: ISO,
  cancelledAt: null,
});

type CallCounts = Record<string, number>;

// Wrap a repo so every method call increments counts[methodName], without
// altering behavior — lets the tests observe the read pattern.
function countCalls<T extends object>(repo: T, counts: CallCounts): T {
  return new Proxy(repo, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const key = String(prop);
        counts[key] = (counts[key] ?? 0) + 1;
        return value.apply(target, args);
      };
    },
  });
}

// Build a seed with `sessionCount` sessions and `bookingsPerSession` bookings
// each, plus repos instrumented to count member / class-session reads.
function setup(sessionCount: number, bookingsPerSession: number) {
  const sessions: ClassSession[] = [];
  const members: Member[] = [];
  const bookings: Booking[] = [];
  for (let s = 0; s < sessionCount; s++) {
    // Later-created sessions start earlier so the sort is actually exercised.
    sessions.push(session(`cs${s}`, 24 * (sessionCount - s)));
    for (let b = 0; b < bookingsPerSession; b++) {
      const memberId = `m${s}-${b}`;
      members.push(member(memberId));
      bookings.push(booking(`b${s}-${b}`, `cs${s}`, memberId));
    }
  }
  const seed = baseSeed({ members, classTypes: [classType("ct1")], sessions, bookings });
  const inner = createInMemoryRepositories(seed);
  const memberCounts: CallCounts = {};
  const sessionCounts: CallCounts = {};
  const repos: Repositories = {
    ...inner,
    members: countCalls(inner.members, memberCounts),
    classSessions: countCalls(inner.classSessions, sessionCounts),
  };
  return { repos, memberCounts, sessionCounts };
}

describe("listBookingRows read pattern", () => {
  it("joins bookings to members and sessions, ordered by startsAt", async () => {
    const { repos } = setup(2, 2);
    const rows = await listBookingRows(repos, "s1");
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.memberName).toMatch(/^m\d+-\d+$/);
      expect(row.className).toBe("Yoga");
      expect(row.classColor).toBe("#111111");
      expect(row.instructor).toBe("I");
    }
    const starts = rows.map((row) => row.startsAt);
    expect(starts).toEqual([...starts].sort((a, b) => a.localeCompare(b)));
  });

  it("issues a fixed number of member and session reads regardless of booking count", async () => {
    const small = setup(1, 3);
    await listBookingRows(small.repos, "s1");

    const large = setup(5, 10);
    await listBookingRows(large.repos, "s1");

    // Reads must not scale with N: identical counts for 3 vs 50 bookings.
    expect(large.memberCounts).toEqual(small.memberCounts);
    expect(large.sessionCounts).toEqual(small.sessionCounts);

    // And the fixed count is small: one batch list each, no per-booking getById.
    expect(small.memberCounts.getById ?? 0).toBe(0);
    expect(small.sessionCounts.getById ?? 0).toBe(0);
    expect(small.memberCounts.listByStudio).toBe(1);
    expect(small.sessionCounts.listByStudio).toBe(1);
  });
});
