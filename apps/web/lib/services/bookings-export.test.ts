import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
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
  startsAt: "2026-06-15T10:00:00.000Z",
  endsAt: "2026-06-15T11:00:00.000Z",
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
  const TO = "2026-06-30T23:59:59.000Z";

  function rangeSeed() {
    return baseSeed({
      classTypes: [classType("ct1")],
      members: [member("m1"), member("m2"), member("m3"), member("m4")],
      sessions: [
        session("cs-at-from", { startsAt: FROM }),
        session("cs-at-to", { startsAt: TO }),
        session("cs-inside", { startsAt: "2026-06-15T10:00:00.000Z" }),
        session("cs-outside", { startsAt: "2026-07-01T00:00:00.000Z" }),
      ],
      bookings: [
        booking("b1", "cs-at-from", "m1"),
        booking("b2", "cs-at-to", "m2"),
        booking("b3", "cs-inside", "m3"),
        booking("b4", "cs-outside", "m4"),
      ],
    });
  }

  it("includes a session starting exactly at `from`", async () => {
    const repos = createInMemoryRepositories(rangeSeed());
    const rows = await listBookingsForExport(repos, "s1", { from: FROM, to: TO });
    expect(rows.some((row) => row.id === "b1")).toBe(true);
  });

  it("includes a session starting exactly at `to` (inclusive upper bound)", async () => {
    const repos = createInMemoryRepositories(rangeSeed());
    const rows = await listBookingsForExport(repos, "s1", { from: FROM, to: TO });
    expect(rows.some((row) => row.id === "b2")).toBe(true);
  });

  it("excludes a session outside [from, to]", async () => {
    const repos = createInMemoryRepositories(rangeSeed());
    const rows = await listBookingsForExport(repos, "s1", { from: FROM, to: TO });
    expect(rows.some((row) => row.id === "b4")).toBe(false);
  });

  it("is unbounded below when `from` is omitted", async () => {
    const repos = createInMemoryRepositories(rangeSeed());
    const rows = await listBookingsForExport(repos, "s1", { to: TO });
    expect(rows.some((row) => row.id === "b1")).toBe(true);
  });

  it("is unbounded above when `to` is omitted", async () => {
    const repos = createInMemoryRepositories(rangeSeed());
    const rows = await listBookingsForExport(repos, "s1", { from: FROM });
    expect(rows.some((row) => row.id === "b4")).toBe(true);
  });

  it("includes a session at the exact `to` instant even when the stored offset differs (+00:00 vs Z)", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m5")],
        sessions: [session("cs-offset", { startsAt: "2026-06-30T23:59:59+00:00" })],
        bookings: [booking("b5", "cs-offset", "m5")],
      }),
    );
    const rows = await listBookingsForExport(repos, "s1", {
      from: FROM,
      to: "2026-06-30T23:59:59.000Z",
    });
    expect(rows.some((row) => row.id === "b5")).toBe(true);
  });
});
