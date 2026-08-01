import { beforeEach, describe, expect, it, vi } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member, Studio, StudioSettings } from "@/lib/db/types";
import type { Repositories } from "@/lib/db/repos/types";
import { listBookingRows } from "./booking-list";

const STUDIO_ID = "studio-1";
const CREATED_AT = "2026-08-01T00:00:00.000Z";

const studio: Studio = {
  id: STUDIO_ID,
  name: "Studio",
  slug: "studio",
  timezone: "UTC",
  createdAt: CREATED_AT,
};

const settings: StudioSettings = {
  studioId: STUDIO_ID,
  currency: "USD",
  taxRateBps: 0,
  cancellationWindowHours: 12,
  waitlistEnabled: true,
  notifyBookingConfirmations: true,
  notifyCancellations: true,
  notifyWaitlistPromotions: true,
  notifyInvoices: true,
};

function buildBookingSeed(count: number): SeedData {
  const classTypes: ClassType[] = [
    {
      id: "type-1",
      studioId: STUDIO_ID,
      name: "Yoga",
      description: null,
      color: "#155e75",
      defaultCapacity: 20,
      defaultPriceCents: 2000,
      createdAt: CREATED_AT,
    },
  ];
  const members: Member[] = Array.from({ length: 10 }, (_, index) => ({
    id: `member-${index}`,
    studioId: STUDIO_ID,
    name: `Member ${index}`,
    email: `member-${index}@example.com`,
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: CREATED_AT,
  }));
  const sessions: ClassSession[] = Array.from({ length: 5 }, (_, index) => ({
    id: `session-${index}`,
    studioId: STUDIO_ID,
    classTypeId: "type-1",
    instructor: `Instructor ${index}`,
    startsAt: `2026-08-${String(index + 2).padStart(2, "0")}T09:00:00.000Z`,
    endsAt: `2026-08-${String(index + 2).padStart(2, "0")}T10:00:00.000Z`,
    capacity: 20,
    priceCents: 2000,
    status: "scheduled",
    createdAt: CREATED_AT,
  }));
  const bookings: Booking[] = Array.from({ length: count }, (_, index) => ({
    id: `booking-${index}`,
    sessionId: sessions[index % sessions.length].id,
    memberId: members[index % members.length].id,
    status: index % 2 === 0 ? "booked" : "waitlisted",
    bookedAt: CREATED_AT,
    cancelledAt: null,
  }));

  return { studio, settings, members, classTypes, sessions, bookings, invoices: [], lineItems: [], outbox: [] };
}

function countLookupReads(count: number) {
  const repos = createInMemoryRepositories(buildBookingSeed(count));
  const memberGetById = vi.spyOn(repos.members, "getById");
  const memberListByStudio = vi.spyOn(repos.members, "listByStudio");
  const sessionGetById = vi.spyOn(repos.classSessions, "getById");
  const sessionListByStudio = vi.spyOn(repos.classSessions, "listByStudio");

  return {
    repos,
    memberGetById,
    memberListByStudio,
    sessionGetById,
    sessionListByStudio,
  };
}

describe("booking list service", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(buildBookingSeed(0));
  });

  it("uses fixed member and session reads as booking counts grow", async () => {
    const fifty = countLookupReads(50);
    await listBookingRows(fifty.repos, STUDIO_ID);

    const hundred = countLookupReads(100);
    await listBookingRows(hundred.repos, STUDIO_ID);

    for (const reads of [fifty, hundred]) {
      expect(reads.memberGetById).toHaveBeenCalledTimes(0);
      expect(reads.sessionGetById).toHaveBeenCalledTimes(0);
      expect(reads.memberListByStudio).toHaveBeenCalledTimes(1);
      expect(reads.sessionListByStudio).toHaveBeenCalledTimes(1);
    }

    expect(fifty.memberListByStudio.mock.calls.length + fifty.sessionListByStudio.mock.calls.length).toBe(
      hundred.memberListByStudio.mock.calls.length + hundred.sessionListByStudio.mock.calls.length,
    );
  });

  it("joins booking rows with fallbacks in ascending session order", async () => {
    repos = createInMemoryRepositories({
      ...buildBookingSeed(0),
      classTypes: [],
      members: [
        {
          id: "member-1",
          studioId: STUDIO_ID,
          name: "Ada Lovelace",
          email: "ada@example.com",
          phone: null,
          status: "active",
          notificationsOptedOut: false,
          createdAt: CREATED_AT,
        },
      ],
      sessions: [
        {
          id: "later",
          studioId: STUDIO_ID,
          classTypeId: "missing-type",
          instructor: "Grace",
          startsAt: "2026-08-05T09:00:00.000Z",
          endsAt: "2026-08-05T10:00:00.000Z",
          capacity: 10,
          priceCents: 2000,
          status: "scheduled",
          createdAt: CREATED_AT,
        },
        {
          id: "earlier",
          studioId: STUDIO_ID,
          classTypeId: "missing-type",
          instructor: "Ada",
          startsAt: "2026-08-03T09:00:00.000Z",
          endsAt: "2026-08-03T10:00:00.000Z",
          capacity: 10,
          priceCents: 2000,
          status: "scheduled",
          createdAt: CREATED_AT,
        },
      ],
      bookings: [
        {
          id: "booking-later",
          sessionId: "later",
          memberId: "missing-member",
          status: "waitlisted",
          bookedAt: CREATED_AT,
          cancelledAt: null,
        },
        {
          id: "booking-earlier",
          sessionId: "earlier",
          memberId: "member-1",
          status: "booked",
          bookedAt: CREATED_AT,
          cancelledAt: null,
        },
      ],
    });

    await expect(listBookingRows(repos, STUDIO_ID)).resolves.toEqual([
      {
        id: "booking-earlier",
        memberName: "Ada Lovelace",
        className: "Class",
        classColor: "#6b7280",
        instructor: "Ada",
        startsAt: "2026-08-03T09:00:00.000Z",
        status: "booked",
      },
      {
        id: "booking-later",
        memberName: "—",
        className: "Class",
        classColor: "#6b7280",
        instructor: "Grace",
        startsAt: "2026-08-05T09:00:00.000Z",
        status: "waitlisted",
      },
    ]);
  });
});
