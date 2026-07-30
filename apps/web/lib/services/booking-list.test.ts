import { describe, expect, it, vi } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, Member } from "@/lib/db/types";
import { listBookingRows } from "./booking-list";

// Regression guard for the bookings-list N+1: the join must issue a bounded
// number of member / class-session reads, independent of the booking count.

const ISO = "2026-01-01T00:00:00.000Z";
const START = Date.parse("2026-02-01T09:00:00.000Z");

const member = (i: number): Member => ({
  id: `m${i}`,
  studioId: "s1",
  name: `Member ${i}`,
  email: `m${i}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
});

const session = (i: number): ClassSession => ({
  id: `sess${i}`,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: `Coach ${i}`,
  startsAt: new Date(START + i * 3_600_000).toISOString(),
  endsAt: new Date(START + i * 3_600_000 + 3_600_000).toISOString(),
  capacity: 10,
  priceCents: 2000,
  status: "scheduled",
  createdAt: ISO,
});

const booking = (i: number): Booking => ({
  id: `b${i}`,
  sessionId: `sess${i}`,
  memberId: `m${i}`,
  status: "confirmed",
  bookedAt: ISO,
  cancelledAt: null,
});

// One member + one session per booking: the worst case for a per-row join.
function seedWithBookings(count: number): SeedData {
  const indexes = Array.from({ length: count }, (_, i) => i);
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
    members: indexes.map(member),
    classTypes: [
      {
        id: "ct1",
        studioId: "s1",
        name: "Flow",
        description: null,
        color: "#111827",
        defaultCapacity: 10,
        defaultPriceCents: 2000,
        createdAt: ISO,
      },
    ],
    sessions: indexes.map(session),
    bookings: indexes.map(booking),
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

// Spies on every read method of the two repositories the report called out.
function spyOnReads(repos: Repositories) {
  const spies = {
    memberList: vi.spyOn(repos.members, "listByStudio"),
    memberGetById: vi.spyOn(repos.members, "getById"),
    memberFindByEmail: vi.spyOn(repos.members, "findByEmail"),
    sessionList: vi.spyOn(repos.classSessions, "listByStudio"),
    sessionGetById: vi.spyOn(repos.classSessions, "getById"),
  };
  return {
    spies,
    total: () => Object.values(spies).reduce((sum, spy) => sum + spy.mock.calls.length, 0),
  };
}

describe("listBookingRows", () => {
  it("reads members and sessions a fixed number of times regardless of booking count", async () => {
    const counts = await Promise.all(
      [1, 50].map(async (n) => {
        const repos = createInMemoryRepositories(seedWithBookings(n));
        const reads = spyOnReads(repos);
        const rows = await listBookingRows(repos, "s1");
        expect(rows).toHaveLength(n);
        expect(reads.spies.memberGetById).not.toHaveBeenCalled();
        expect(reads.spies.sessionGetById).not.toHaveBeenCalled();
        return reads.total();
      }),
    );

    // One bulk read per repository, identical for N=1 and N=50.
    expect(counts[0]).toBe(2);
    expect(counts[1]).toBe(counts[0]);
  });

  it("joins each booking to its member, class type, and session, ordered by start", async () => {
    const repos = createInMemoryRepositories(seedWithBookings(3));
    const rows = await listBookingRows(repos, "s1");

    expect(rows).toEqual([
      {
        id: "b0",
        memberName: "Member 0",
        className: "Flow",
        classColor: "#111827",
        instructor: "Coach 0",
        startsAt: new Date(START).toISOString(),
        status: "confirmed",
      },
      {
        id: "b1",
        memberName: "Member 1",
        className: "Flow",
        classColor: "#111827",
        instructor: "Coach 1",
        startsAt: new Date(START + 3_600_000).toISOString(),
        status: "confirmed",
      },
      {
        id: "b2",
        memberName: "Member 2",
        className: "Flow",
        classColor: "#111827",
        instructor: "Coach 2",
        startsAt: new Date(START + 2 * 3_600_000).toISOString(),
        status: "confirmed",
      },
    ]);
  });

  it("honours the session range filter", async () => {
    const repos = createInMemoryRepositories(seedWithBookings(3));
    const rows = await listBookingRows(repos, "s1", {
      from: new Date(START + 3_600_000).toISOString(),
    });
    expect(rows.map((row) => row.id)).toEqual(["b1", "b2"]);
  });
});
