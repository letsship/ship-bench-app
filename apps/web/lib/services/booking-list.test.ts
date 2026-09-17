import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { listBookingRows } from "./booking-list";

const NOW = new Date("2026-07-01T12:00:00.000Z");
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
  name: `Member ${id}`,
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
  name: `Class ${id}`,
  description: null,
  color: "#123456",
  defaultCapacity: 10,
  defaultPriceCents: 1000,
  createdAt: ISO,
});

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "Instructor A",
  startsAt: FUTURE,
  endsAt: FUTURE_END,
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: ISO,
  ...over,
});

const booking = (id: string, sessionId: string, memberId: string, over: Partial<Booking> = {}): Booking => ({
  id,
  sessionId,
  memberId,
  status: "booked",
  bookedAt: ISO,
  cancelledAt: null,
  ...over,
});

// Wraps a Repositories object in a call-counting proxy that records how many
// times each member/classSessions/bookings/classTypes method is invoked. Used
// to assert that listBookingRows issues a bounded number of repo reads
// regardless of how many bookings are returned.
function withCallCounts(repos: Repositories): Repositories & {
  counts: Record<string, number>;
} {
  const counts: Record<string, number> = {};
  const bump = (key: string) => () => {
    counts[key] = (counts[key] ?? 0) + 1;
  };
  const wrapRepo = <K extends keyof Repositories>(key: K, repo: Repositories[K]): Repositories[K] => {
    return new Proxy(repo as object, {
      get(target, prop) {
        const value = Reflect.get(target as object, prop);
        if (typeof value === "function") {
          return (...args: unknown[]) => {
            bump(`${String(key)}.${String(prop)}`)();
            return value.apply(target, args);
          };
        }
        return value;
      },
    }) as Repositories[K];
  };
  return new Proxy(repos, {
    get(target, prop) {
      if (prop === "counts") return counts;
      const value = Reflect.get(target, prop);
      if (prop === "members" || prop === "classSessions" || prop === "bookings" || prop === "classTypes") {
        return wrapRepo(prop as keyof Repositories, value as Repositories[typeof prop]);
      }
      return value;
    },
  }) as Repositories & { counts: Record<string, number> };
}

describe("listBookingRows", () => {
  it("returns rows joined to member + class, sorted by startsAt (parity)", async () => {
    const seed = baseSeed({
      members: [member("m1"), member("m2")],
      classTypes: [classType("ct1")],
      sessions: [
        session("cs1", { startsAt: "2026-07-08T08:00:00.000Z" }),
        session("cs2", { startsAt: "2026-07-07T08:00:00.000Z" }),
      ],
      bookings: [
        booking("b1", "cs1", "m1"),
        booking("b2", "cs2", "m2", { status: "waitlisted" }),
      ],
    });
    const repos = createInMemoryRepositories(seed);
    const rows = await listBookingRows(repos, "s1");
    expect(rows).toHaveLength(2);
    // sorted by startsAt ascending
    expect(rows[0].startsAt).toBe("2026-07-07T08:00:00.000Z");
    expect(rows[1].startsAt).toBe("2026-07-08T08:00:00.000Z");
    expect(rows.map((r) => r.memberName)).toEqual(["Member m2", "Member m1"]);
    expect(rows[0].className).toBe("Class ct1");
    expect(rows[0].classColor).toBe("#123456");
    expect(rows[0].instructor).toBe("Instructor A");
    expect(rows[1].status).toBe("booked");
    expect(rows[0].status).toBe("waitlisted");
  });

  it("falls back to defaults when a member is missing but the session is in range", async () => {
    const seed = baseSeed({
      members: [],
      classTypes: [classType("ct1")],
      sessions: [session("cs1", { startsAt: "2026-07-08T08:00:00.000Z" })],
      // Booking references a member that does not exist; session is in range.
      bookings: [booking("b1", "cs1", "m-ghost")],
    });
    const repos = createInMemoryRepositories(seed);
    const rows = await listBookingRows(repos, "s1");
    expect(rows).toEqual([
      {
        id: "b1",
        memberName: "—",
        className: "Class ct1",
        classColor: "#123456",
        instructor: "Instructor A",
        startsAt: "2026-07-08T08:00:00.000Z",
        status: "booked",
      },
    ]);
  });

  describe("bounded reads (no N+1)", () => {
    function buildSeedWithN(n: number): SeedData {
      const members: Member[] = Array.from({ length: Math.min(n, 8) }, (_, i) => member(`m${i}`));
      const types = [classType("ct1"), classType("ct2")];
      const sessions: ClassSession[] = Array.from({ length: Math.max(2, Math.ceil(n / 3)) }, (_, i) =>
        session(`cs${i}`, {
          classTypeId: i % 2 === 0 ? "ct1" : "ct2",
          startsAt: new Date(NOW.getTime() + (i + 1) * 86_400_000).toISOString(),
          endsAt: new Date(NOW.getTime() + (i + 1) * 86_400_000 + 3_600_000).toISOString(),
        }),
      );
      const bookings: Booking[] = Array.from({ length: n }, (_, i) =>
        booking(`b${i}`, sessions[i % sessions.length].id, members[i % members.length].id),
      );
      return baseSeed({ members, classTypes: types, sessions, bookings });
    }

    async function callCounts(repos: Repositories & { counts: Record<string, number> }, n: number) {
      const before = { ...repos.counts };
      await listBookingRows(repos, "s1");
      const after = repos.counts;
      return {
        membersGetById: (after["members.getById"] ?? 0) - (before["members.getById"] ?? 0),
        membersListByIds: (after["members.listByIds"] ?? 0) - (before["members.listByIds"] ?? 0),
        classSessionsGetById: (after["classSessions.getById"] ?? 0) - (before["classSessions.getById"] ?? 0),
        classSessionsListByStudio:
          (after["classSessions.listByStudio"] ?? 0) - (before["classSessions.listByStudio"] ?? 0),
        bookingsListBySessionIds:
          (after["bookings.listBySessionIds"] ?? 0) - (before["bookings.listBySessionIds"] ?? 0),
        classTypesListByStudio:
          (after["classTypes.listByStudio"] ?? 0) - (before["classTypes.listByStudio"] ?? 0),
        n,
      };
    }

    it("issues zero getById calls and a fixed number of batch calls, independent of N", async () => {
      const small = withCallCounts(createInMemoryRepositories(buildSeedWithN(5)));
      const large = withCallCounts(createInMemoryRepositories(buildSeedWithN(50)));

      const smallCounts = await callCounts(small, 5);
      const largeCounts = await callCounts(large, 50);

      expect(smallCounts.membersGetById).toBe(0);
      expect(largeCounts.membersGetById).toBe(0);
      expect(smallCounts.classSessionsGetById).toBe(0);
      expect(largeCounts.classSessionsGetById).toBe(0);

      // batch reads are each called a small fixed number of times, not scaling with N
      expect(smallCounts.membersListByIds).toBe(1);
      expect(largeCounts.membersListByIds).toBe(1);
      expect(smallCounts.classSessionsListByStudio).toBe(1);
      expect(largeCounts.classSessionsListByStudio).toBe(1);
      expect(smallCounts.bookingsListBySessionIds).toBe(1);
      expect(largeCounts.bookingsListBySessionIds).toBe(1);
      expect(smallCounts.classTypesListByStudio).toBe(1);
      expect(largeCounts.classTypesListByStudio).toBe(1);
    });
  });
});
