import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
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
  email: `${id}@example.com`,
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
  startsAt: ISO,
  endsAt: ISO,
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
  const FROM = "2026-06-01T00:00:00.000Z";
  const TO = "2026-06-30T23:59:59.999Z";

  function rangeSeed(): SeedData {
    return baseSeed({
      members: [member("m1", { name: "Amara" })],
      classTypes: [classType("ct1", { name: "Vinyasa Flow" })],
      sessions: [
        session("before", { startsAt: "2026-05-31T23:59:59.999Z" }),
        session("at-from", { startsAt: FROM }),
        session("inside", { startsAt: "2026-06-15T09:00:00.000Z" }),
        session("at-to", { startsAt: TO }),
        session("after", { startsAt: "2026-07-01T00:00:00.000Z" }),
      ],
      bookings: [
        booking("b-before", "before", "m1"),
        booking("b-at-from", "at-from", "m1"),
        booking("b-inside", "inside", "m1"),
        booking("b-at-to", "at-to", "m1"),
        booking("b-after", "after", "m1"),
      ],
    });
  }

  it("includes sessions starting exactly at both bounds (inclusive range)", async () => {
    const repos = createInMemoryRepositories(rangeSeed());
    const rows = await listBookingsForExport(repos, "s1", { from: FROM, to: TO });
    const startTimes = rows.map((row) => row.startsAt).sort();
    expect(startTimes).toEqual(["2026-06-01T00:00:00.000Z", "2026-06-15T09:00:00.000Z", TO]);
  });

  it("is unbounded on the from side when omitted", async () => {
    const repos = createInMemoryRepositories(rangeSeed());
    const rows = await listBookingsForExport(repos, "s1", { to: FROM });
    expect(rows.map((row) => row.startsAt)).toEqual([
      "2026-05-31T23:59:59.999Z",
      "2026-06-01T00:00:00.000Z",
    ]);
  });

  it("is unbounded on the to side when omitted", async () => {
    const repos = createInMemoryRepositories(rangeSeed());
    const rows = await listBookingsForExport(repos, "s1", { from: TO });
    expect(rows.map((row) => row.startsAt)).toEqual([TO, "2026-07-01T00:00:00.000Z"]);
  });

  it("returns everything when no range is given", async () => {
    const repos = createInMemoryRepositories(rangeSeed());
    const rows = await listBookingsForExport(repos, "s1");
    expect(rows).toHaveLength(5);
  });

  it("maps class name, member name, email, ISO startsAt, and status", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1", { name: "Chiara Rossi", email: "chiara@example.com" })],
        classTypes: [classType("ct1", { name: "Reformer Pilates" })],
        sessions: [session("cs1", { startsAt: "2026-06-10T09:00:00.000Z" })],
        bookings: [booking("b1", "cs1", "m1", { status: "attended" })],
      }),
    );
    const rows = await listBookingsForExport(repos, "s1", {});
    expect(rows).toEqual([
      {
        startsAt: "2026-06-10T09:00:00.000Z",
        className: "Reformer Pilates",
        memberName: "Chiara Rossi",
        memberEmail: "chiara@example.com",
        status: "attended",
      },
    ]);
  });
});
