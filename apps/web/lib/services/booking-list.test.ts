import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { listBookingRows, type BookingRow } from "./booking-list";

// ---------------------------------------------------------------------------
// Counting decorator: wraps any in-memory repos so we can tally member and
// class-session repository reads and prove they do not scale with N.
// ---------------------------------------------------------------------------

interface ReadCounts {
  members: { listByStudio: number; getById: number; findByEmail: number };
  classSessions: { listByStudio: number; getById: number };
}

function zeroCounts(): ReadCounts {
  return {
    members: { listByStudio: 0, getById: 0, findByEmail: 0 },
    classSessions: { listByStudio: 0, getById: 0 },
  };
}

function countingRepos(repos: Repositories, counts: ReadCounts): Repositories {
  return {
    ...repos,
    members: {
      async listByStudio(studioId: string) {
        counts.members.listByStudio += 1;
        return repos.members.listByStudio(studioId);
      },
      async getById(id: string) {
        counts.members.getById += 1;
        return repos.members.getById(id);
      },
      async findByEmail(studioId: string, email: string) {
        counts.members.findByEmail += 1;
        return repos.members.findByEmail(studioId, email);
      },
      async insert(member: Member) {
        return repos.members.insert(member);
      },
      async update(id: string, patch: Partial<Member>) {
        return repos.members.update(id, patch);
      },
    },
    classSessions: {
      async listByStudio(studioId: string, range?: { from?: string; to?: string }) {
        counts.classSessions.listByStudio += 1;
        return repos.classSessions.listByStudio(studioId, range);
      },
      async getById(id: string) {
        counts.classSessions.getById += 1;
        return repos.classSessions.getById(id);
      },
      async insert(session: ClassSession) {
        return repos.classSessions.insert(session);
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers: fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-07-15T12:00:00.000Z");
const ISO = NOW.toISOString();
const T1 = new Date(NOW.getTime() + 86_400_000).toISOString();
const T1_END = new Date(NOW.getTime() + 86_400_000 + 3_600_000).toISOString();
const T2 = new Date(NOW.getTime() + 2 * 86_400_000).toISOString();
const T2_END = new Date(NOW.getTime() + 2 * 86_400_000 + 3_600_000).toISOString();
const STUDIO_ID = "s1";

function makeMember(id: string, name: string): Member {
  return {
    id,
    studioId: STUDIO_ID,
    name,
    email: `${id}@e.co`,
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: ISO,
  };
}

function makeClassType(id: string, name: string, color: string): ClassType {
  return {
    id,
    studioId: STUDIO_ID,
    name,
    description: null,
    color,
    defaultCapacity: 10,
    defaultPriceCents: 1000,
    createdAt: ISO,
  };
}

function makeSession(id: string, classTypeId: string, startsAt: string, endsAt: string): ClassSession {
  return {
    id,
    studioId: STUDIO_ID,
    classTypeId,
    instructor: "Instructor",
    startsAt,
    endsAt,
    capacity: 100,
    priceCents: 1000,
    status: "scheduled",
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

// ---------------------------------------------------------------------------
// Small-N seed: 1 booking, 1 session, 1 member, 1 class type
// ---------------------------------------------------------------------------

function smallSeed(): SeedData {
  const ct = makeClassType("ct1", "Vinyasa", "#5b8c5a");
  const session = makeSession("cs1", ct.id, T1, T1_END);
  const member = makeMember("m1", "Alice");
  return {
    studio: { id: STUDIO_ID, name: "S", slug: "s", timezone: "UTC", createdAt: ISO },
    settings: {
      studioId: STUDIO_ID,
      currency: "EUR",
      taxRateBps: 900,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
    members: [member],
    classTypes: [ct],
    sessions: [session],
    bookings: [makeBooking("b1", session.id, member.id)],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

// ---------------------------------------------------------------------------
// Large-N seed: 200 bookings across 2 sessions and 5 members (reuses shared
// sessions/members so the Map-join is exercised at scale).
// ---------------------------------------------------------------------------

function largeSeed(): SeedData {
  const ct1 = makeClassType("ct1", "Vinyasa", "#5b8c5a");
  const ct2 = makeClassType("ct2", "Pilates", "#3f6f9f");
  const s1 = makeSession("cs1", ct1.id, T1, T1_END);
  const s2 = makeSession("cs2", ct2.id, T2, T2_END);
  const members = [
    makeMember("m1", "Alice"),
    makeMember("m2", "Bob"),
    makeMember("m3", "Carol"),
    makeMember("m4", "Dave"),
    makeMember("m5", "Eve"),
  ];

  const bookings: Booking[] = [];
  const sessionIds = [s1.id, s2.id];
  for (let i = 0; i < 200; i++) {
    const sessionId = sessionIds[i % sessionIds.length];
    const member = members[i % members.length];
    bookings.push(makeBooking(`b${i}`, sessionId, member.id));
  }

  return {
    studio: { id: STUDIO_ID, name: "S", slug: "s", timezone: "UTC", createdAt: ISO },
    settings: {
      studioId: STUDIO_ID,
      currency: "EUR",
      taxRateBps: 900,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
    members,
    classTypes: [ct1, ct2],
    sessions: [s1, s2],
    bookings,
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("booking-list N+1 regression", () => {
  it("issues a fixed, small number of member + class-session reads regardless of N", async () => {
    // Small N
    const countsSmall = zeroCounts();
    const reposSmall = countingRepos(createInMemoryRepositories(smallSeed()), countsSmall);
    const rowsSmall = await listBookingRows(reposSmall, STUDIO_ID);

    // Large N
    const countsLarge = zeroCounts();
    const reposLarge = countingRepos(createInMemoryRepositories(largeSeed()), countsLarge);
    const rowsLarge = await listBookingRows(reposLarge, STUDIO_ID);

    // Both runs perform exactly the same number of member reads (one
    // listByStudio, zero getById) and exactly the same number of
    // class-session reads (one listByStudio, zero getById) regardless of N.
    expect(countsSmall.members).toEqual(countsLarge.members);
    expect(countsSmall.classSessions).toEqual(countsLarge.classSessions);

    // Verify the actual counts are small and bounded:
    // - exactly 1 members.listByStudio
    // - exactly 1 classSessions.listByStudio
    // - exactly 0 getById (the old N+1 pattern)
    expect(countsSmall.members).toEqual({ listByStudio: 1, getById: 0, findByEmail: 0 });
    expect(countsSmall.classSessions).toEqual({ listByStudio: 1, getById: 0 });
  });

  it("returns rows with correct member names, class names, colors and sort order", async () => {
    const repos = createInMemoryRepositories(largeSeed());
    const rows = await listBookingRows(repos, STUDIO_ID);

    // All rows carry populated names/colors (no "—" fallback for known entities)
    for (const row of rows) {
      expect(row.memberName).not.toBe("—");
      expect(row.className).not.toBe("Class");
      expect(row.classColor).not.toBe("#6b7280");
      expect(row.instructor).toBe("Instructor");
    }

    // Rows are sorted ascending by startsAt
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].startsAt.localeCompare(rows[i].startsAt)).toBeLessThanOrEqual(0);
    }
  });
});