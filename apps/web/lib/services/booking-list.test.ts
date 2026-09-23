import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { listBookingRows, type BookingRow } from "./booking-list";

const NOW = new Date("2026-09-23T12:00:00.000Z");
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();

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

function makeSession(id: string, startsAt: string): ClassSession {
  return {
    id,
    studioId: "s1",
    classTypeId: classType.id,
    instructor: "Noor",
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 3_600_000).toISOString(),
    capacity: 16,
    priceCents: 1800,
    status: "scheduled",
    createdAt: ISO,
  };
}

const sessions = [
  makeSession("cs1", FUTURE),
  makeSession("cs2", new Date(NOW.getTime() + 8 * 86_400_000).toISOString()),
  makeSession("cs3", new Date(NOW.getTime() + 9 * 86_400_000).toISOString()),
];

function makeMember(id: string, name: string): Member {
  return {
    id,
    studioId: "s1",
    name,
    email: `${id}@e.co`,
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: ISO,
  };
}

function makeBooking(id: string, sessionId: string, memberId: string): Booking {
  return {
    id,
    sessionId,
    memberId,
    status: "booked",
    bookedAt: ISO,
    cancelledAt: null,
  };
}

function countingProxy(repos: Repositories): {
  repos: Repositories;
  counts: { members: Record<string, number>; classSessions: Record<string, number> };
} {
  const counts = { members: {} as Record<string, number>, classSessions: {} as Record<string, number> };
  const tick = (bucket: Record<string, number>, key: string) => {
    bucket[key] = (bucket[key] ?? 0) + 1;
  };
  const wrap = <T extends object>(target: T, bucket: Record<string, number>): T =>
    new Proxy(target, {
      get(target, prop) {
        const value = target[prop as keyof T];
        if (typeof value === "function") {
          return (...args: unknown[]) => {
            tick(bucket, String(prop));
            return (value as (...args: unknown[]) => unknown).apply(target, args);
          };
        }
        return value;
      },
    });
  return {
    repos: {
      ...repos,
      members: wrap(repos.members, counts.members),
      classSessions: wrap(repos.classSessions, counts.classSessions),
    },
    counts,
  };
}

function totalCalls(bucket: Record<string, number>): number {
  return Object.values(bucket).reduce((sum, n) => sum + n, 0);
}

function seedWithBookings(n: number): SeedData {
  const members: Member[] = [];
  for (let i = 0; i < Math.max(n, 8); i += 1) {
    members.push(makeMember(`m${i + 1}`, `Member ${i + 1}`));
  }
  const bookings: Booking[] = [];
  for (let i = 0; i < n; i += 1) {
    const session = sessions[i % sessions.length];
    const member = members[i % members.length];
    bookings.push(makeBooking(`b${i + 1}`, session.id, member.id));
  }
  return baseSeed({ classTypes: [classType], sessions, members, bookings });
}

describe("listBookingRows — N+1 reads", () => {
  it("does not grow members/classSessions reads with the number of bookings", async () => {
    const small = countingProxy(createInMemoryRepositories(seedWithBookings(3)));
    const large = countingProxy(createInMemoryRepositories(seedWithBookings(60)));

    await listBookingRows(small.repos, "s1");
    await listBookingRows(large.repos, "s1");

    const smallTotal = totalCalls(small.counts.members) + totalCalls(small.counts.classSessions);
    const largeTotal = totalCalls(large.counts.members) + totalCalls(large.counts.classSessions);
    expect(largeTotal).toBe(smallTotal);
    expect(smallTotal).toBeLessThanOrEqual(4);
  });

  it("never calls members.getById or classSessions.getById", async () => {
    const { repos, counts } = countingProxy(createInMemoryRepositories(seedWithBookings(20)));
    await listBookingRows(repos, "s1");
    expect(counts.members.getById ?? 0).toBe(0);
    expect(counts.classSessions.getById ?? 0).toBe(0);
  });
});

describe("listBookingRows — row shape, fallbacks, and ordering", () => {
  it("produces the expected rows ordered by startsAt", async () => {
    const { repos } = countingProxy(createInMemoryRepositories(seedWithBookings(3)));
    const rows = await listBookingRows(repos, "s1");
    const expected: BookingRow[] = [
      {
        id: "b1",
        memberName: "Member 1",
        className: "Vinyasa Flow",
        classColor: "#5b8c5a",
        instructor: "Noor",
        startsAt: FUTURE,
        status: "booked",
      },
      {
        id: "b2",
        memberName: "Member 2",
        className: "Vinyasa Flow",
        classColor: "#5b8c5a",
        instructor: "Noor",
        startsAt: new Date(NOW.getTime() + 8 * 86_400_000).toISOString(),
        status: "booked",
      },
      {
        id: "b3",
        memberName: "Member 3",
        className: "Vinyasa Flow",
        classColor: "#5b8c5a",
        instructor: "Noor",
        startsAt: new Date(NOW.getTime() + 9 * 86_400_000).toISOString(),
        status: "booked",
      },
    ];
    expect(rows).toEqual(expected);
  });

  it("falls back when a booking references a missing member or class type", async () => {
    const seed = baseSeed({
      classTypes: [],
      sessions,
      members: [makeMember("m1", "Member 1")],
      bookings: [
        makeBooking("b-ok", sessions[0].id, "m1"),
        makeBooking("b-orphan", sessions[2].id, "m-missing"),
      ],
    });
    const { repos } = countingProxy(createInMemoryRepositories(seed));
    const rows = await listBookingRows(repos, "s1");
    expect(rows).toEqual([
      {
        id: "b-ok",
        memberName: "Member 1",
        className: "Class",
        classColor: "#6b7280",
        instructor: "Noor",
        startsAt: FUTURE,
        status: "booked",
      },
      {
        id: "b-orphan",
        memberName: "—",
        className: "Class",
        classColor: "#6b7280",
        instructor: "Noor",
        startsAt: new Date(NOW.getTime() + 9 * 86_400_000).toISOString(),
        status: "booked",
      },
    ]);
  });
});
