import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { listBookingExportRows } from "./booking-list";

// Fixed calendar dates: the export is a date-range report, so nothing here
// depends on the wall clock.
const ISO = "2026-01-01T00:00:00.000Z";
const JUNE_1 = "2026-06-01T09:00:00.000Z";
const JUNE_15 = "2026-06-15T09:00:00.000Z";
const JUNE_30 = "2026-06-30T18:00:00.000Z";
const MAY_31 = "2026-05-31T09:00:00.000Z";
const JULY_1 = "2026-07-01T09:00:00.000Z";

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
  instructor: "Noor",
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

// One session on each boundary day plus one just outside each end.
function repos(): Repositories {
  const seed: SeedData = {
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
    members: [member("m1", { name: "Rossi, Chiara" }), member("m2")],
    classTypes: [classType("ct1", "Vinyasa Flow")],
    sessions: [
      session("before", MAY_31),
      session("start", JUNE_1),
      session("middle", JUNE_15),
      session("end", JUNE_30),
      session("after", JULY_1),
    ],
    bookings: [
      booking("b-before", "before", "m1"),
      booking("b-end", "end", "m2"),
      booking("b-middle", "middle", "m1"),
      booking("b-start", "start", "m1"),
      booking("b-after", "after", "m2"),
    ],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
  return createInMemoryRepositories(seed);
}

describe("listBookingExportRows", () => {
  it("joins the class name plus the member's name and email", async () => {
    const rows = await listBookingExportRows(repos(), "s1", { from: JUNE_15, to: JUNE_15 });
    expect(rows).toEqual([
      {
        startsAt: JUNE_15,
        className: "Vinyasa Flow",
        memberName: "Rossi, Chiara",
        email: "m1@example.com",
        status: "booked",
      },
    ]);
  });

  it("includes sessions starting exactly on BOTH bounds and excludes those outside", async () => {
    const rows = await listBookingExportRows(repos(), "s1", { from: JUNE_1, to: JUNE_30 });
    expect(rows.map((row) => row.startsAt)).toEqual([JUNE_1, JUNE_15, JUNE_30]);
  });

  it("matches a bound written with a different ISO-8601 precision", async () => {
    const rows = await listBookingExportRows(repos(), "s1", {
      from: "2026-06-30T18:00:00Z",
      to: "2026-06-30T18:00:00Z",
    });
    expect(rows.map((row) => row.startsAt)).toEqual([JUNE_30]);
  });

  it("leaves an omitted bound unbounded on that side", async () => {
    const openStart = await listBookingExportRows(repos(), "s1", { to: JUNE_1 });
    expect(openStart.map((row) => row.startsAt)).toEqual([MAY_31, JUNE_1]);

    const openEnd = await listBookingExportRows(repos(), "s1", { from: JUNE_30 });
    expect(openEnd.map((row) => row.startsAt)).toEqual([JUNE_30, JULY_1]);
  });

  it("returns every booking, sorted by session start, when no range is given", async () => {
    const rows = await listBookingExportRows(repos(), "s1");
    expect(rows.map((row) => row.startsAt)).toEqual([MAY_31, JUNE_1, JUNE_15, JUNE_30, JULY_1]);
  });

  it("returns no rows when the range covers nothing", async () => {
    const rows = await listBookingExportRows(repos(), "s1", {
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-31T00:00:00.000Z",
    });
    expect(rows).toEqual([]);
  });
});
