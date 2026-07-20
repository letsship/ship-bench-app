import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { listBookingsForExport } from "./booking-list";

const NOW = new Date();
const ISO = NOW.toISOString();
const BEFORE_RANGE = new Date("2026-06-14T10:00:00Z").toISOString();
const RANGE_START = new Date("2026-06-15T10:00:00Z").toISOString();
const RANGE_MIDDLE = new Date("2026-06-15T14:00:00Z").toISOString();
const RANGE_END = new Date("2026-06-30T18:00:00Z").toISOString();
const AFTER_RANGE = new Date("2026-07-01T10:00:00Z").toISOString();

const END_TIME_OFFSET = 3600000; // 1 hour

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
  endsAt: new Date(new Date(startsAt).getTime() + END_TIME_OFFSET).toISOString(),
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
  it("includes bookings whose session start equals the lower bound (inclusive)", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", RANGE_START)],
        members: [member("m1")],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );
    const studioId = "s1";

    const rows = await listBookingsForExport(repos, studioId, { from: RANGE_START });
    expect(rows).toHaveLength(1);
    expect(rows[0].startsAt).toBe(RANGE_START);
  });

  it("includes bookings whose session start equals the upper bound (inclusive)", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", RANGE_END)],
        members: [member("m1")],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );
    const studioId = "s1";

    const rows = await listBookingsForExport(repos, studioId, { to: RANGE_END });
    expect(rows).toHaveLength(1);
    expect(rows[0].startsAt).toBe(RANGE_END);
  });

  it("excludes bookings before the lower bound", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", BEFORE_RANGE)],
        members: [member("m1")],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );
    const studioId = "s1";

    const rows = await listBookingsForExport(repos, studioId, { from: RANGE_START });
    expect(rows).toHaveLength(0);
  });

  it("excludes bookings after the upper bound", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", AFTER_RANGE)],
        members: [member("m1")],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );
    const studioId = "s1";

    const rows = await listBookingsForExport(repos, studioId, { to: RANGE_END });
    expect(rows).toHaveLength(0);
  });

  it("returns all bookings when both from and to are omitted", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [
          session("cs1", BEFORE_RANGE),
          session("cs2", RANGE_START),
          session("cs3", RANGE_MIDDLE),
          session("cs4", RANGE_END),
          session("cs5", AFTER_RANGE),
        ],
        members: [member("m1")],
        bookings: [
          booking("b1", "cs1", "m1"),
          booking("b2", "cs2", "m1"),
          booking("b3", "cs3", "m1"),
          booking("b4", "cs4", "m1"),
          booking("b5", "cs5", "m1"),
        ],
      }),
    );
    const studioId = "s1";

    const rows = await listBookingsForExport(repos, studioId, {});
    expect(rows).toHaveLength(5);
  });

  it("filters on both bounds when both from and to are provided", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [
          session("cs1", BEFORE_RANGE),
          session("cs2", RANGE_START),
          session("cs3", RANGE_MIDDLE),
          session("cs4", RANGE_END),
          session("cs5", AFTER_RANGE),
        ],
        members: [member("m1")],
        bookings: [
          booking("b1", "cs1", "m1"),
          booking("b2", "cs2", "m1"),
          booking("b3", "cs3", "m1"),
          booking("b4", "cs4", "m1"),
          booking("b5", "cs5", "m1"),
        ],
      }),
    );
    const studioId = "s1";

    const rows = await listBookingsForExport(repos, studioId, { from: RANGE_START, to: RANGE_END });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.startsAt)).toEqual([RANGE_START, RANGE_MIDDLE, RANGE_END]);
  });

  it("populates email field from the member", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", RANGE_START)],
        members: [member("m1", { email: "alice@example.com" })],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );
    const studioId = "s1";

    const rows = await listBookingsForExport(repos, studioId, {});
    expect(rows[0].email).toBe("alice@example.com");
  });

  it("renders email as empty string when member is not found", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", RANGE_START)],
        members: [],
        bookings: [booking("b1", "cs1", "m_unknown")],
      }),
    );
    const studioId = "s1";

    const rows = await listBookingsForExport(repos, studioId, {});
    expect(rows[0].email).toBe("");
  });
});
