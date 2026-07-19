import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { listBookingRows } from "./booking-list";

const NOW = new Date("2026-07-19T12:00:00Z");
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

function baseSeed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: "s1", name: "Studio", slug: "s", timezone: "Europe/Amsterdam", createdAt: ISO },
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
  name: `Member ${id}`,
  email: `${id}@example.com`,
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
  instructor: "Instructor",
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
  sessionId: string,
  memberId: string,
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

// Spy on repository methods to count calls
interface CallCounts {
  membersListByStudio: number;
  membersGetById: number;
  classSessionsListByStudio: number;
  classSessionsGetById: number;
}

function wrapReposWithCounters(repos: Repositories): { repos: Repositories; counts: CallCounts } {
  const counts: CallCounts = {
    membersListByStudio: 0,
    membersGetById: 0,
    classSessionsListByStudio: 0,
    classSessionsGetById: 0,
  };

  const originalMembers = repos.members;
  const originalSessions = repos.classSessions;

  return {
    repos: {
      ...repos,
      members: {
        ...originalMembers,
        async listByStudio(studioId) {
          counts.membersListByStudio++;
          return originalMembers.listByStudio(studioId);
        },
        async getById(id) {
          counts.membersGetById++;
          return originalMembers.getById(id);
        },
      },
      classSessions: {
        ...originalSessions,
        async listByStudio(studioId, range) {
          counts.classSessionsListByStudio++;
          return originalSessions.listByStudio(studioId, range);
        },
        async getById(id) {
          counts.classSessionsGetById++;
          return originalSessions.getById(id);
        },
      },
    },
    counts,
  };
}

describe("listBookingRows", () => {
  it("does not grow repository reads with the number of bookings (small set)", async () => {
    const members = [member("m1"), member("m2"), member("m3")];
    const sessions = [session("cs1"), session("cs2", { startsAt: FUTURE })];
    const bookings = [
      booking("b1", "cs1", "m1"),
      booking("b2", "cs1", "m2"),
      booking("b3", "cs2", "m3"),
    ];

    const seed = baseSeed({ members, classTypes: [classType("ct1")], sessions, bookings });
    const baseRepos = createInMemoryRepositories(seed);
    const { repos, counts: smallCounts } = wrapReposWithCounters(baseRepos);

    await listBookingRows(repos, "s1");

    expect(smallCounts.membersGetById).toBe(0);
    expect(smallCounts.classSessionsGetById).toBe(0);
    expect(smallCounts.membersListByStudio).toBe(1);
    expect(smallCounts.classSessionsListByStudio).toBe(1);
  });

  it("does not grow repository reads with the number of bookings (large set)", async () => {
    const members = Array.from({ length: 100 }, (_, i) => member(`m${i}`));
    const sessions = Array.from({ length: 50 }, (_, i) =>
      session(`cs${i}`, { startsAt: new Date(NOW.getTime() + i * 3_600_000).toISOString() }),
    );
    const bookings = Array.from({ length: 200 }, (_, i) => {
      const memberIdx = i % 100;
      const sessionIdx = i % 50;
      return booking(`b${i}`, `cs${sessionIdx}`, `m${memberIdx}`);
    });

    const seed = baseSeed({ members, classTypes: [classType("ct1")], sessions, bookings });
    const baseRepos = createInMemoryRepositories(seed);
    const { repos, counts: largeCounts } = wrapReposWithCounters(baseRepos);

    await listBookingRows(repos, "s1");

    expect(largeCounts.membersGetById).toBe(0);
    expect(largeCounts.classSessionsGetById).toBe(0);
    expect(largeCounts.membersListByStudio).toBe(1);
    expect(largeCounts.classSessionsListByStudio).toBe(1);
  });

  it("returns the correct fields and order for a fixed seed", async () => {
    const members = [member("m1", { name: "Alice" }), member("m2", { name: "Bob" })];
    const classTypes = [classType("ct1")];
    classTypes[0].name = "Yoga";
    classTypes[0].color = "#ff0000";
    const sessions = [
      session("cs1", { startsAt: FUTURE, instructor: "John", classTypeId: "ct1" }),
      session("cs2", {
        startsAt: new Date(NOW.getTime() + 8 * 86_400_000).toISOString(),
        instructor: "Jane",
        classTypeId: "ct1",
      }),
    ];
    const bookings = [
      booking("b1", "cs1", "m1"),
      booking("b2", "cs1", "m2"),
      booking("b3", "cs2", "m1"),
    ];

    const seed = baseSeed({ members, classTypes, sessions, bookings });
    const repos = createInMemoryRepositories(seed);

    const rows = await listBookingRows(repos, "s1");

    expect(rows).toHaveLength(3);

    expect(rows[0]).toMatchObject({
      id: "b1",
      memberName: "Alice",
      className: "Yoga",
      classColor: "#ff0000",
      instructor: "John",
      status: "booked",
    });

    expect(rows[1]).toMatchObject({
      id: "b2",
      memberName: "Bob",
      className: "Yoga",
      classColor: "#ff0000",
      instructor: "John",
      status: "booked",
    });

    expect(rows[2]).toMatchObject({
      id: "b3",
      memberName: "Alice",
      className: "Yoga",
      classColor: "#ff0000",
      instructor: "Jane",
      status: "booked",
    });

    // Verify sorted by startsAt
    expect(rows[0].startsAt).toEqual(FUTURE);
    expect(rows[1].startsAt).toEqual(FUTURE);
    expect(rows[2].startsAt).toEqual(new Date(NOW.getTime() + 8 * 86_400_000).toISOString());
  });

  it("uses fallback values correctly", async () => {
    // Create a scenario where members might be missing
    const members = [member("m1")];
    const sessions = [session("cs1")];
    const bookings = [
      booking("b1", "cs1", "m1"),
      booking("b2", "cs1", "m_unknown"), // References existing session but non-existent member
    ];

    const seed = baseSeed({ members, classTypes: [classType("ct1")], sessions, bookings });
    const repos = createInMemoryRepositories(seed);

    const rows = await listBookingRows(repos, "s1");

    expect(rows).toHaveLength(2);

    // First booking should have real data
    expect(rows[0].memberName).toEqual("Member m1");
    expect(rows[0].className).toEqual("Yoga");

    // Second booking should have fallback for member, but real data for session
    expect(rows[1].memberName).toEqual("—");
    expect(rows[1].className).toEqual("Yoga");
    expect(rows[1].instructor).toEqual("Instructor");
    expect(rows[1].startsAt).toEqual(FUTURE);
  });
});
