import { describe, expect, it, vi } from "vitest";
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

const classType = (id: string, over: Partial<ClassType> = {}): ClassType => ({
  id,
  studioId: "s1",
  name: "Yoga",
  description: null,
  color: "#111111",
  defaultCapacity: 10,
  defaultPriceCents: 1000,
  createdAt: ISO,
  ...over,
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

function seedWithBookings(count: number): SeedData {
  const memberCount = Math.min(count, 5);
  const sessionCount = Math.min(count, 5);
  const members = Array.from({ length: memberCount }, (_, i) => member(`m${i}`));
  const sessions = Array.from({ length: sessionCount }, (_, i) =>
    session(`cs${i}`, {
      // Descending fixture times so the ascending sort is observable.
      startsAt: new Date(NOW.getTime() + (sessionCount - i) * 3_600_000).toISOString(),
      endsAt: new Date(NOW.getTime() + (sessionCount - i) * 3_600_000 + 3_600_000).toISOString(),
    }),
  );
  const bookings = Array.from({ length: count }, (_, i) =>
    booking(`b${i}`, `m${i % memberCount}`, { sessionId: `cs${i % sessionCount}` }),
  );
  return baseSeed({ classTypes: [classType("ct1")], members, sessions, bookings });
}

function spyReads(repos: Repositories) {
  return {
    membersGetById: vi.spyOn(repos.members, "getById"),
    membersListByStudio: vi.spyOn(repos.members, "listByStudio"),
    sessionsGetById: vi.spyOn(repos.classSessions, "getById"),
    sessionsListByStudio: vi.spyOn(repos.classSessions, "listByStudio"),
  };
}

const joinReads = (spies: ReturnType<typeof spyReads>) =>
  spies.membersGetById.mock.calls.length +
  spies.membersListByStudio.mock.calls.length +
  spies.sessionsGetById.mock.calls.length +
  spies.sessionsListByStudio.mock.calls.length;

describe("listBookingRows", () => {
  it("never reads members or class sessions per booking, regardless of N", async () => {
    const runReads = async (count: number) => {
      const repos = createInMemoryRepositories(seedWithBookings(count));
      const spies = spyReads(repos);
      const rows = await listBookingRows(repos, "s1");
      expect(rows).toHaveLength(count);
      expect(spies.membersGetById).not.toHaveBeenCalled();
      expect(spies.sessionsGetById).not.toHaveBeenCalled();
      return joinReads(spies);
    };

    const smallReads = await runReads(5);
    const largeReads = await runReads(50);
    // Bounded: a small fixed number of reads that does not grow with N.
    expect(smallReads).toBeLessThanOrEqual(4);
    expect(largeReads).toBe(smallReads);
  });

  it("preserves the output contract: fields and startsAt ordering", async () => {
    const repos = createInMemoryRepositories(seedWithBookings(12));
    const rows = await listBookingRows(repos, "s1");

    expect(rows).toHaveLength(12);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([
        "classColor",
        "className",
        "id",
        "instructor",
        "memberName",
        "startsAt",
        "status",
      ]);
      expect(row.memberName).toMatch(/^m\d$/);
      expect(row.className).toBe("Yoga");
      expect(row.classColor).toBe("#111111");
      expect(row.instructor).toBe("I");
      expect(row.status).toBe("booked");
    }
    const starts = rows.map((row) => row.startsAt);
    expect(starts).toEqual([...starts].sort((a, b) => a.localeCompare(b)));
  });
});
