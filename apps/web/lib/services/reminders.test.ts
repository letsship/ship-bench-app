import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { runReminders } from "./reminders";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const ISO = NOW.toISOString();
const nowFn = () => ISO;

const WITHIN_WINDOW = new Date(NOW.getTime() + 5 * 3_600_000).toISOString();
const WITHIN_WINDOW_END = new Date(NOW.getTime() + 6 * 3_600_000).toISOString();
const OUTSIDE_WINDOW = new Date(NOW.getTime() + 30 * 3_600_000).toISOString();
const OUTSIDE_WINDOW_END = new Date(NOW.getTime() + 31 * 3_600_000).toISOString();

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
  startsAt: WITHIN_WINDOW,
  endsAt: WITHIN_WINDOW_END,
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: ISO,
  ...over,
});

const booking = (id: string, memberId: string, over: Partial<Booking> = {}): Booking => ({
  id,
  sessionId: "cs1",
  memberId,
  status: "booked",
  bookedAt: ISO,
  cancelledAt: null,
  ...over,
});

describe("runReminders", () => {
  let repos: Repositories;

  it("queues a booking_reminder for a confirmed seat in the next 24 hours", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
        bookings: [booking("b1", "m1")],
      }),
    );
    const result = await runReminders(repos, "s1", { now: nowFn });
    expect(result).toEqual({ queued: 1, skipped: 0 });

    const rows = await repos.outbox.listByKind("booking_reminder");
    expect(rows).toHaveLength(1);
    expect(rows[0].memberId).toBe("m1");
    expect(rows[0].sentAt).toBeNull();
    const payload = JSON.parse(rows[0].payload) as { data: { bookingId: string } };
    expect(payload.data.bookingId).toBe("b1");
  });

  it("skips waitlisted members", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
        bookings: [booking("b1", "m1", { status: "waitlisted" })],
      }),
    );
    const result = await runReminders(repos, "s1", { now: nowFn });
    expect(result).toEqual({ queued: 0, skipped: 0 });
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(0);
  });

  it("skips sessions outside the 24-hour window", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { startsAt: OUTSIDE_WINDOW, endsAt: OUTSIDE_WINDOW_END })],
        members: [member("m1")],
        bookings: [booking("b1", "m1")],
      }),
    );
    const result = await runReminders(repos, "s1", { now: nowFn });
    expect(result).toEqual({ queued: 0, skipped: 0 });
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(0);
  });

  it("skips members who have opted out of notifications", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1", { notificationsOptedOut: true })],
        bookings: [booking("b1", "m1")],
      }),
    );
    const result = await runReminders(repos, "s1", { now: nowFn });
    expect(result).toEqual({ queued: 0, skipped: 1 });
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(0);
  });

  it("is idempotent: a second run queues no duplicate reminder", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
        bookings: [booking("b1", "m1")],
      }),
    );
    await runReminders(repos, "s1", { now: nowFn });
    const second = await runReminders(repos, "s1", { now: nowFn });
    expect(second).toEqual({ queued: 0, skipped: 1 });
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(1);
  });
});
