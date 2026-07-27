import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member, StudioSettings } from "@/lib/db/types";
import { runReminders } from "./reminders";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const ISO = NOW.toISOString();
const clock = { now: () => ISO };

const WITHIN_WINDOW = new Date(NOW.getTime() + 2 * 3_600_000).toISOString();
const WITHIN_WINDOW_END = new Date(NOW.getTime() + 3 * 3_600_000).toISOString();
const OUTSIDE_WINDOW = new Date(NOW.getTime() + 48 * 3_600_000).toISOString();
const OUTSIDE_WINDOW_END = new Date(NOW.getTime() + 49 * 3_600_000).toISOString();

const settings = (over: Partial<StudioSettings> = {}): StudioSettings => ({
  studioId: "s1",
  currency: "EUR",
  taxRateBps: 0,
  cancellationWindowHours: 12,
  waitlistEnabled: true,
  notifyBookingConfirmations: true,
  notifyCancellations: true,
  notifyWaitlistPromotions: true,
  notifyInvoices: true,
  notifyBookingReminders: true,
  ...over,
});

const classType = (id: string): ClassType => ({
  id,
  studioId: "s1",
  name: "Vinyasa Flow",
  description: null,
  color: "#111111",
  defaultCapacity: 10,
  defaultPriceCents: 1800,
  createdAt: ISO,
});

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

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "Noor",
  startsAt: WITHIN_WINDOW,
  endsAt: WITHIN_WINDOW_END,
  capacity: 10,
  priceCents: 1800,
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

function baseSeed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "UTC", createdAt: ISO },
    settings: settings(),
    members: [],
    classTypes: [classType("ct1")],
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

describe("runReminders", () => {
  it("queues one reminder for a confirmed seat in a session starting within 24 hours", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        sessions: [session("cs1")],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );

    const summary = await runReminders(repos, clock);
    expect(summary).toEqual({ queued: 1, skipped: 0 });

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      memberId: "m1",
      kind: "booking_reminder",
      dedupeKey: "booking_reminder:b1",
    });
  });

  it("skips waitlisted members and sessions outside the 24-hour window", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1"), member("m2")],
        sessions: [
          session("cs1"),
          session("cs2", { startsAt: OUTSIDE_WINDOW, endsAt: OUTSIDE_WINDOW_END }),
        ],
        bookings: [
          booking("b1", "cs1", "m1", { status: "waitlisted" }),
          booking("b2", "cs2", "m2"),
        ],
      }),
    );

    const summary = await runReminders(repos, clock);
    expect(summary.queued).toBe(0);
    expect(await repos.outbox.listPending()).toHaveLength(0);
  });

  it("skips a member who has opted out of notifications", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1", { notificationsOptedOut: true })],
        sessions: [session("cs1")],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );

    const summary = await runReminders(repos, clock);
    expect(summary).toEqual({ queued: 0, skipped: 1 });
    expect(await repos.outbox.listPending()).toHaveLength(0);
  });

  it("is idempotent: a second run does not queue a duplicate for the same booking", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        sessions: [session("cs1")],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );

    const first = await runReminders(repos, clock);
    expect(first.queued).toBe(1);

    const second = await runReminders(repos, clock);
    expect(second).toEqual({ queued: 0, skipped: 1 });

    expect(await repos.outbox.listPending()).toHaveLength(1);
  });
});
