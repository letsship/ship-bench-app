import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { listBookingsForExport } from "./booking-list";

const ISO = "2026-01-01T00:00:00.000Z";

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

const session = (id: string, startsAt: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "I",
  startsAt,
  endsAt: startsAt,
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

describe("listBookingsForExport", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1"), member("m2")],
        classTypes: [classType("ct1")],
        sessions: [
          session("cs1", "2026-06-01T00:00:00.000Z"),
          session("cs2", "2026-06-15T09:00:00.000Z"),
          session("cs3", "2026-06-30T00:00:00.000Z"),
        ],
        bookings: [
          booking("b1", "cs1", "m1"),
          booking("b2", "cs2", "m2"),
          booking("b3", "cs3", "m1"),
        ],
      }),
    );
  });

  it("includes bookings starting exactly on the from/to bounds (inclusive both ends)", async () => {
    const rows = await listBookingsForExport(repos, "s1", {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-30T00:00:00.000Z",
    });
    expect(rows.map((row) => row.id)).toEqual(["b1", "b2", "b3"]);
  });

  it("is unbounded on an omitted side", async () => {
    const fromOnly = await listBookingsForExport(repos, "s1", {
      from: "2026-06-15T09:00:00.000Z",
    });
    expect(fromOnly.map((row) => row.id)).toEqual(["b2", "b3"]);

    const toOnly = await listBookingsForExport(repos, "s1", {
      to: "2026-06-15T09:00:00.000Z",
    });
    expect(toOnly.map((row) => row.id)).toEqual(["b1", "b2"]);
  });

  it("excludes bookings outside the window", async () => {
    const rows = await listBookingsForExport(repos, "s1", {
      from: "2026-07-01T00:00:00.000Z",
    });
    expect(rows).toEqual([]);
  });

  it("orders results by session start", async () => {
    const rows = await listBookingsForExport(repos, "s1");
    expect(rows.map((row) => row.id)).toEqual(["b1", "b2", "b3"]);
  });

  it("carries the member's email", async () => {
    const rows = await listBookingsForExport(repos, "s1", {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-01T00:00:00.000Z",
    });
    expect(rows[0].email).toBe("m1@e.co");
  });

  it("includes a boundary booking even when the stored startsAt format differs from the query bound", async () => {
    const boundaryRepos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        classTypes: [classType("ct1")],
        sessions: [session("cs1", "2026-06-25T08:00:00+00:00")],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );

    const rows = await listBookingsForExport(boundaryRepos, "s1", {
      from: "2026-06-25T08:00:00.000Z",
      to: "2026-06-25T08:00:00.000Z",
    });
    expect(rows.map((row) => row.id)).toEqual(["b1"]);
  });
});
