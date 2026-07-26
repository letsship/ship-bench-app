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

const member = (id: string): Member => ({
  id,
  studioId: "s1",
  name: `Member ${id}`,
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

const session = (id: string, startsAt: string): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "Instructor",
  startsAt,
  endsAt: FUTURE_END,
  capacity: 500,
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

// Wraps a Repositories instance and counts calls to the members/class-session
// repos, distinguishing the batched `listByStudio` reads (expected: one call
// each, regardless of N) from per-row `getById` reads (expected: zero — those
// are the N+1 pattern this service must not reintroduce).
function withReadCounters(repos: Repositories) {
  const counts = {
    membersListByStudio: 0,
    membersGetById: 0,
    sessionsListByStudio: 0,
    sessionsGetById: 0,
  };
  const wrapped: Repositories = {
    ...repos,
    members: {
      ...repos.members,
      listByStudio: (...args) => {
        counts.membersListByStudio += 1;
        return repos.members.listByStudio(...args);
      },
      getById: (...args) => {
        counts.membersGetById += 1;
        return repos.members.getById(...args);
      },
    },
    classSessions: {
      ...repos.classSessions,
      listByStudio: (...args) => {
        counts.sessionsListByStudio += 1;
        return repos.classSessions.listByStudio(...args);
      },
      getById: (...args) => {
        counts.sessionsGetById += 1;
        return repos.classSessions.getById(...args);
      },
    },
  };
  return { repos: wrapped, counts };
}

function buildScaledSeed(bookingCount: number): SeedData {
  const members = Array.from({ length: bookingCount }, (_, i) => member(`m${i}`));
  const sessions = Array.from({ length: bookingCount }, (_, i) =>
    session(`cs${i}`, new Date(new Date(FUTURE).getTime() + i * 60_000).toISOString()),
  );
  const bookings = Array.from({ length: bookingCount }, (_, i) =>
    booking(`b${i}`, `cs${i}`, `m${i}`),
  );
  return baseSeed({ classTypes: [classType("ct1")], members, sessions, bookings });
}

describe("listBookingRows", () => {
  it("keeps member and class-session repo reads constant as booking count grows", async () => {
    const small = withReadCounters(createInMemoryRepositories(buildScaledSeed(5)));
    await listBookingRows(small.repos, "s1");

    const large = withReadCounters(createInMemoryRepositories(buildScaledSeed(300)));
    await listBookingRows(large.repos, "s1");

    expect(small.counts.membersGetById).toBe(0);
    expect(small.counts.sessionsGetById).toBe(0);
    expect(large.counts.membersGetById).toBe(0);
    expect(large.counts.sessionsGetById).toBe(0);

    expect(large.counts.membersListByStudio).toBe(small.counts.membersListByStudio);
    expect(large.counts.sessionsListByStudio).toBe(small.counts.sessionsListByStudio);
    expect(large.counts.membersListByStudio).toBeLessThanOrEqual(1);
    expect(large.counts.sessionsListByStudio).toBeLessThanOrEqual(1);
  });

  it("returns rows with the exact fields, values and startsAt order", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1"), member("m2")],
        sessions: [session("cs1", FUTURE), session("cs2", FUTURE_END)],
        bookings: [booking("b1", "cs2", "m2"), booking("b2", "cs1", "m1")],
      }),
    );

    const rows = await listBookingRows(repos, "s1");

    expect(rows).toEqual([
      {
        id: "b2",
        memberName: "Member m1",
        className: "Yoga",
        classColor: "#111111",
        instructor: "Instructor",
        startsAt: FUTURE,
        status: "booked",
      },
      {
        id: "b1",
        memberName: "Member m2",
        className: "Yoga",
        classColor: "#111111",
        instructor: "Instructor",
        startsAt: FUTURE_END,
        status: "booked",
      },
    ]);
  });
});
