import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { listBookingsForExport } from "./bookings-export";

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

const member = (id: string, name: string): Member => ({
  id,
  studioId: "s1",
  name,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
});

const classType = (id: string, name: string): ClassType => ({
  id,
  studioId: "s1",
  name,
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
  instructor: "I",
  startsAt,
  endsAt: startsAt,
  capacity: 10,
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

describe("listBookingsForExport", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1", "Amara"), member("m2", "Bram")],
        classTypes: [classType("ct1", "Vinyasa Flow")],
        sessions: [
          session("cs1", "2026-06-01T09:00:00.000Z"),
          session("cs2", "2026-06-15T09:00:00.000Z"),
          session("cs3", "2026-06-30T09:00:00.000Z"),
        ],
        bookings: [
          booking("b1", "cs1", "m1"),
          booking("b2", "cs2", "m2"),
          booking("b3", "cs3", "m1"),
        ],
      }),
    );
  });

  it("returns all bookings joined to session/class/member with email populated, ordered by start", async () => {
    const rows = await listBookingsForExport(repos, "s1");
    expect(rows.map((row) => row.startsAt)).toEqual([
      "2026-06-01T09:00:00.000Z",
      "2026-06-15T09:00:00.000Z",
      "2026-06-30T09:00:00.000Z",
    ]);
    expect(rows[0]).toEqual({
      startsAt: "2026-06-01T09:00:00.000Z",
      className: "Vinyasa Flow",
      memberName: "Amara",
      email: "m1@e.co",
      status: "booked",
    });
  });

  it("includes bookings whose session start exactly equals the from/to bounds", async () => {
    const rows = await listBookingsForExport(repos, "s1", {
      from: "2026-06-01T09:00:00.000Z",
      to: "2026-06-30T09:00:00.000Z",
    });
    expect(rows).toHaveLength(3);
  });

  it("excludes bookings outside a narrower range", async () => {
    const rows = await listBookingsForExport(repos, "s1", {
      from: "2026-06-02T00:00:00.000Z",
      to: "2026-06-16T00:00:00.000Z",
    });
    expect(rows.map((row) => row.startsAt)).toEqual(["2026-06-15T09:00:00.000Z"]);
  });

  it("treats an omitted bound as unbounded on that side", async () => {
    const fromOnly = await listBookingsForExport(repos, "s1", {
      from: "2026-06-15T09:00:00.000Z",
    });
    expect(fromOnly.map((row) => row.startsAt)).toEqual([
      "2026-06-15T09:00:00.000Z",
      "2026-06-30T09:00:00.000Z",
    ]);

    const toOnly = await listBookingsForExport(repos, "s1", { to: "2026-06-15T09:00:00.000Z" });
    expect(toOnly.map((row) => row.startsAt)).toEqual([
      "2026-06-01T09:00:00.000Z",
      "2026-06-15T09:00:00.000Z",
    ]);
  });
});
