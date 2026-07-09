import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { listBookingsForExport } from "./booking-export";

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
  startsAt: "2026-06-15T08:00:00.000Z",
  endsAt: "2026-06-15T09:00:00.000Z",
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
  it("joins session, class type, and member (including email)", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1", { name: "Vinyasa Flow" })],
        sessions: [session("cs1")],
        members: [member("m1", { name: "Amara Okafor", email: "amara@example.com" })],
        bookings: [booking("b1", "cs1", "m1", { status: "attended" })],
      }),
    );
    const rows = await listBookingsForExport(repos, "s1");
    expect(rows).toEqual([
      {
        startsAt: "2026-06-15T08:00:00.000Z",
        className: "Vinyasa Flow",
        memberName: "Amara Okafor",
        email: "amara@example.com",
        status: "attended",
      },
    ]);
  });

  it("includes a session starting exactly at range.from", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { startsAt: "2026-06-01T00:00:00.000Z" })],
        members: [member("m1")],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );
    const rows = await listBookingsForExport(repos, "s1", {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-30T23:59:59.000Z",
    });
    expect(rows).toHaveLength(1);
  });

  it("includes a session starting exactly at range.to (inclusive upper bound)", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { startsAt: "2026-06-30T23:59:59.000Z" })],
        members: [member("m1")],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );
    const rows = await listBookingsForExport(repos, "s1", {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-30T23:59:59.000Z",
    });
    expect(rows).toHaveLength(1);
  });

  it("is unbounded on a side when that bound is omitted", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [
          session("cs1", { startsAt: "2020-01-01T00:00:00.000Z" }),
          session("cs2", { startsAt: "2099-01-01T00:00:00.000Z" }),
        ],
        members: [member("m1")],
        bookings: [booking("b1", "cs1", "m1"), booking("b2", "cs2", "m1")],
      }),
    );
    const fromOnly = await listBookingsForExport(repos, "s1", { from: "2026-01-01T00:00:00.000Z" });
    expect(fromOnly).toHaveLength(1);
    expect(fromOnly[0].startsAt).toBe("2099-01-01T00:00:00.000Z");

    const toOnly = await listBookingsForExport(repos, "s1", { to: "2026-01-01T00:00:00.000Z" });
    expect(toOnly).toHaveLength(1);
    expect(toOnly[0].startsAt).toBe("2020-01-01T00:00:00.000Z");
  });

  it("returns an empty list when the range excludes everything", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { startsAt: "2026-06-15T08:00:00.000Z" })],
        members: [member("m1")],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );
    const rows = await listBookingsForExport(repos, "s1", {
      from: "2027-01-01T00:00:00.000Z",
      to: "2027-01-31T00:00:00.000Z",
    });
    expect(rows).toEqual([]);
  });
});
