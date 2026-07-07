import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { listBookingsForExport } from "./booking-export";

const NOW = new Date("2026-06-15T12:00:00.000Z");
const ISO = NOW.toISOString();

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

const session = (id: string, startsAt: string): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "I",
  startsAt,
  endsAt: new Date(new Date(startsAt).getTime() + 3_600_000).toISOString(),
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: ISO,
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

function seed(over: Record<string, unknown> = {}) {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: ISO } as const,
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
    members: [member("m1", { name: "Alice" }), member("m2", { name: "Bob" })],
    classTypes: [classType("ct1")],
    sessions: [
      session("cs1", "2026-06-01T08:00:00.000Z"),
      session("cs2", "2026-06-15T08:00:00.000Z"),
      session("cs3", "2026-06-30T08:00:00.000Z"),
      session("cs4", "2026-07-01T08:00:00.000Z"),
    ],
    bookings: [
      booking("b1", "cs1", "m1"),
      booking("b2", "cs2", "m1"),
      booking("b3", "cs3", "m1"),
      booking("b4", "cs4", "m1"),
    ],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

describe("listBookingsForExport", () => {
  let repos: Repositories;

  beforeEach(async () => {
    repos = createInMemoryRepositories(seed());
  });

  it("includes a booking whose session starts exactly at from", async () => {
    const rows = await listBookingsForExport(repos, "s1", {
      from: "2026-06-01T08:00:00.000Z",
    });
    expect(rows).toHaveLength(4);
    expect(rows[0].startsAt).toBe("2026-06-01T08:00:00.000Z");
  });

  it("includes a booking whose session starts exactly at to (inclusive bound)", async () => {
    const rows = await listBookingsForExport(repos, "s1", {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-30T08:00:00.000Z",
    });
    expect(rows).toHaveLength(3);
    expect(rows[2].startsAt).toBe("2026-06-30T08:00:00.000Z");
  });

  it("excludes a session starting after to", async () => {
    const rows = await listBookingsForExport(repos, "s1", {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-25T00:00:00.000Z",
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.startsAt)).toEqual([
      "2026-06-01T08:00:00.000Z",
      "2026-06-15T08:00:00.000Z",
    ]);
  });

  it("returns all bookings when from and to are omitted (unbounded)", async () => {
    const rows = await listBookingsForExport(repos, "s1");
    expect(rows).toHaveLength(4);
  });

  it("returns rows with all expected fields populated", async () => {
    const rows = await listBookingsForExport(repos, "s1", {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-30T23:59:59.999Z",
    });
    expect(rows[0]).toMatchObject({
      startsAt: expect.any(String),
      className: "Yoga",
      memberName: "Alice",
      email: "m1@e.co",
      status: "booked",
    });
  });

  it("uses fallback text when member or class type is missing", async () => {
    const localRepos = createInMemoryRepositories({
      ...seed(),
      members: [],
      classTypes: [],
    });
    const rows = await listBookingsForExport(localRepos, "s1");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].memberName).toBe("—");
    expect(rows[0].className).toBe("Class");
  });
});
