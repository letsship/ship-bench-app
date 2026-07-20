import { describe, expect, it, vi } from "vitest";
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

const booking = (id: string, memberId: string, over: Partial<Booking> = {}): Booking => ({
  id,
  sessionId: "cs1",
  memberId,
  status: "booked",
  bookedAt: ISO,
  cancelledAt: null,
  ...over,
});

describe("booking-list service", () => {
  describe("bounded reads", () => {
    it("does not issue per-booking getById calls for members or sessions", async () => {
      const repos = createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1"), session("cs2"), session("cs3")],
          members: [member("m1"), member("m2"), member("m3"), member("m4")],
          bookings: [
            booking("b1", "m1"),
            booking("b2", "m2"),
            booking("b3", "m3", { sessionId: "cs2" }),
            booking("b4", "m4", { sessionId: "cs3" }),
          ],
        }),
      );

      const memberGetByIdSpy = vi.spyOn(repos.members, "getById");
      const sessionGetByIdSpy = vi.spyOn(repos.classSessions, "getById");

      await listBookingRows(repos, "s1");

      expect(memberGetByIdSpy).not.toHaveBeenCalled();
      expect(sessionGetByIdSpy).not.toHaveBeenCalled();
    });

    it("uses constant number of reads regardless of booking count", async () => {
      // Create a small set of bookings
      const smallBookings = Array.from({ length: 5 }, (_, i) => booking(`b${i}`, `m${i % 3}`));
      const smallSessions = Array.from({ length: 2 }, (_, i) => session(`cs${i}`));
      const smallMembers = Array.from({ length: 3 }, (_, i) => member(`m${i}`));

      const smallRepos = createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: smallSessions,
          members: smallMembers,
          bookings: smallBookings.map((b, i) => ({ ...b, sessionId: smallSessions[i % 2].id })),
        }),
      );

      const smallMembersListSpy = vi.spyOn(smallRepos.members, "listByStudio");
      const smallSessionsListSpy = vi.spyOn(smallRepos.classSessions, "listByStudio");
      const smallMembersGetSpy = vi.spyOn(smallRepos.members, "getById");
      const smallSessionsGetSpy = vi.spyOn(smallRepos.classSessions, "getById");

      await listBookingRows(smallRepos, "s1");

      const smallMembersListCount = smallMembersListSpy.mock.calls.length;
      const smallSessionsListCount = smallSessionsListSpy.mock.calls.length;
      const smallMembersGetCount = smallMembersGetSpy.mock.calls.length;
      const smallSessionsGetCount = smallSessionsGetSpy.mock.calls.length;

      // Create a large set of bookings (10x)
      const largeBookings = Array.from({ length: 50 }, (_, i) => booking(`b${i}`, `m${i % 10}`));
      const largeSessions = Array.from({ length: 5 }, (_, i) => session(`cs${i}`));
      const largeMembers = Array.from({ length: 10 }, (_, i) => member(`m${i}`));

      const largeRepos = createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: largeSessions,
          members: largeMembers,
          bookings: largeBookings.map((b, i) => ({ ...b, sessionId: largeSessions[i % 5].id })),
        }),
      );

      const largeMembersListSpy = vi.spyOn(largeRepos.members, "listByStudio");
      const largeSessionsListSpy = vi.spyOn(largeRepos.classSessions, "listByStudio");
      const largeMembersGetSpy = vi.spyOn(largeRepos.members, "getById");
      const largeSessionsGetSpy = vi.spyOn(largeRepos.classSessions, "getById");

      await listBookingRows(largeRepos, "s1");

      const largeMembersListCount = largeMembersListSpy.mock.calls.length;
      const largeSessionsListCount = largeSessionsListSpy.mock.calls.length;
      const largeMembersGetCount = largeMembersGetSpy.mock.calls.length;
      const largeSessionsGetCount = largeSessionsGetSpy.mock.calls.length;

      // Assert read counts are constant (not growing with N)
      expect(smallMembersListCount).toBeGreaterThan(0);
      expect(smallSessionsListCount).toBeGreaterThan(0);
      expect(smallMembersListCount).toBe(largeMembersListCount);
      expect(smallSessionsListCount).toBe(largeSessionsListCount);

      // Assert no per-booking getById calls
      expect(smallMembersGetCount).toBe(0);
      expect(smallSessionsGetCount).toBe(0);
      expect(largeMembersGetCount).toBe(0);
      expect(largeSessionsGetCount).toBe(0);
    });
  });

  describe("return shape and ordering", () => {
    it("returns BookingRow with all expected fields", async () => {
      const repos = createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1")],
          members: [member("m1")],
          bookings: [booking("b1", "m1")],
        }),
      );

      const rows = await listBookingRows(repos, "s1");
      expect(rows).toHaveLength(1);
      const row = rows[0];

      expect(row).toHaveProperty("id");
      expect(row).toHaveProperty("memberName");
      expect(row).toHaveProperty("className");
      expect(row).toHaveProperty("classColor");
      expect(row).toHaveProperty("instructor");
      expect(row).toHaveProperty("startsAt");
      expect(row).toHaveProperty("status");
    });

    it("orders results by startsAt", async () => {
      const now = new Date();
      const time1 = new Date(now.getTime() + 1 * 86_400_000).toISOString();
      const time1End = new Date(now.getTime() + 1 * 86_400_000 + 3_600_000).toISOString();
      const time2 = new Date(now.getTime() + 2 * 86_400_000).toISOString();
      const time2End = new Date(now.getTime() + 2 * 86_400_000 + 3_600_000).toISOString();
      const time3 = new Date(now.getTime() + 3 * 86_400_000).toISOString();
      const time3End = new Date(now.getTime() + 3 * 86_400_000 + 3_600_000).toISOString();

      const repos = createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [
            session("cs1", { startsAt: time3, endsAt: time3End }),
            session("cs2", { startsAt: time1, endsAt: time1End }),
            session("cs3", { startsAt: time2, endsAt: time2End }),
          ],
          members: [member("m1"), member("m2"), member("m3")],
          bookings: [
            booking("b1", "m1", { sessionId: "cs1" }),
            booking("b2", "m2", { sessionId: "cs2" }),
            booking("b3", "m3", { sessionId: "cs3" }),
          ],
        }),
      );

      const rows = await listBookingRows(repos, "s1");
      expect(rows).toHaveLength(3);
      expect(rows[0].startsAt).toBe(time1);
      expect(rows[1].startsAt).toBe(time2);
      expect(rows[2].startsAt).toBe(time3);
    });

    it("handles missing members and sessions gracefully", async () => {
      const repos = createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1")],
          members: [], // No members
          bookings: [booking("b1", "unknown_member")],
        }),
      );

      const rows = await listBookingRows(repos, "s1");
      expect(rows).toHaveLength(1);
      expect(rows[0].memberName).toBe("—");
    });
  });
});
