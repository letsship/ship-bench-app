import { describe, expect, it, vi } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type {
  Booking,
  ClassSession,
  ClassType,
  Member,
  Studio,
  StudioSettings,
} from "@/lib/db/types";
import { listBookingRows } from "./booking-list";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const ISO = NOW.toISOString();

const studio: Studio = {
  id: "s1",
  name: "S",
  slug: "s",
  timezone: "Europe/Amsterdam",
  createdAt: ISO,
};

const settings: StudioSettings = {
  studioId: "s1",
  currency: "EUR",
  taxRateBps: 900,
  cancellationWindowHours: 12,
  waitlistEnabled: true,
  notifyBookingConfirmations: true,
  notifyCancellations: true,
  notifyWaitlistPromotions: true,
  notifyInvoices: true,
};

const classType: ClassType = {
  id: "ct1",
  studioId: "s1",
  name: "Yoga",
  description: null,
  color: "#111111",
  defaultCapacity: 500,
  defaultPriceCents: 1000,
  createdAt: ISO,
};

const session: ClassSession = {
  id: "cs1",
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "Instructor",
  startsAt: "2026-03-16T09:00:00.000Z",
  endsAt: "2026-03-16T10:00:00.000Z",
  capacity: 500,
  priceCents: 1000,
  status: "scheduled",
  createdAt: ISO,
};

function buildMembers(count: number): Member[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    studioId: "s1",
    name: `Member ${i}`,
    email: `m${i}@e.co`,
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: ISO,
  }));
}

function buildBookings(count: number): Booking[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `b${i}`,
    sessionId: "cs1",
    memberId: `m${i}`,
    status: "booked",
    bookedAt: ISO,
    cancelledAt: null,
  }));
}

function seededRepos(bookingCount: number): Repositories {
  return createInMemoryRepositories({
    studio,
    settings,
    members: buildMembers(bookingCount),
    classTypes: [classType],
    sessions: [session],
    bookings: buildBookings(bookingCount),
    invoices: [],
    lineItems: [],
    outbox: [],
  });
}

interface Spies {
  membersListByStudio: ReturnType<typeof vi.spyOn>;
  classTypesListByStudio: ReturnType<typeof vi.spyOn>;
  classSessionsListByStudio: ReturnType<typeof vi.spyOn>;
  bookingsListBySessionIds: ReturnType<typeof vi.spyOn>;
  membersGetById: ReturnType<typeof vi.spyOn>;
  classSessionsGetById: ReturnType<typeof vi.spyOn>;
}

function spyOnRepos(repos: Repositories): Spies {
  return {
    membersListByStudio: vi.spyOn(repos.members, "listByStudio"),
    classTypesListByStudio: vi.spyOn(repos.classTypes, "listByStudio"),
    classSessionsListByStudio: vi.spyOn(repos.classSessions, "listByStudio"),
    bookingsListBySessionIds: vi.spyOn(repos.bookings, "listBySessionIds"),
    membersGetById: vi.spyOn(repos.members, "getById"),
    classSessionsGetById: vi.spyOn(repos.classSessions, "getById"),
  };
}

describe("listBookingRows read count", () => {
  it("issues a fixed number of repository reads regardless of booking count", async () => {
    const smallRepos = seededRepos(5);
    const smallSpies = spyOnRepos(smallRepos);
    await listBookingRows(smallRepos, "s1");

    const largeRepos = seededRepos(200);
    const largeSpies = spyOnRepos(largeRepos);
    await listBookingRows(largeRepos, "s1");

    for (const spies of [smallSpies, largeSpies]) {
      expect(spies.membersListByStudio).toHaveBeenCalledTimes(1);
      expect(spies.classTypesListByStudio).toHaveBeenCalledTimes(1);
      expect(spies.classSessionsListByStudio).toHaveBeenCalledTimes(1);
      expect(spies.bookingsListBySessionIds).toHaveBeenCalledTimes(1);
      expect(spies.membersGetById).not.toHaveBeenCalled();
      expect(spies.classSessionsGetById).not.toHaveBeenCalled();
    }

    // The call counts must be identical no matter how many bookings exist —
    // that's the whole point of the regression: reads don't scale with N.
    expect(largeSpies.membersListByStudio.mock.calls.length).toBe(
      smallSpies.membersListByStudio.mock.calls.length,
    );
    expect(largeSpies.classSessionsListByStudio.mock.calls.length).toBe(
      smallSpies.classSessionsListByStudio.mock.calls.length,
    );
  });
});

describe("listBookingRows output shape", () => {
  it("returns rows with the expected fields, sorted by startsAt ascending", async () => {
    const repos = seededRepos(3);
    const rows = await listBookingRows(repos, "s1");

    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row).toEqual({
        id: expect.any(String),
        memberName: expect.any(String),
        className: "Yoga",
        classColor: "#111111",
        instructor: "Instructor",
        startsAt: session.startsAt,
        status: "booked",
      });
    }

    const sorted = [...rows].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    expect(rows).toEqual(sorted);
  });
});
