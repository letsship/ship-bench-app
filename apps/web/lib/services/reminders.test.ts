import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { runReminders } from "./reminders";

const NOW = new Date();
const ISO = NOW.toISOString();
const IN_12H = new Date(NOW.getTime() + 12 * 3600 * 1000).toISOString();
const IN_25H = new Date(NOW.getTime() + 25 * 3600 * 1000).toISOString();

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
  endsAt: new Date(new Date(startsAt).getTime() + 3600 * 1000).toISOString(),
  capacity: 10,
  priceCents: 1000,
  status: "active",
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

describe("runReminders", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories();
  });

  it("queues a pending booking_reminder row for a confirmed seat in the next 24h", async () => {
    const m1 = member("m1");
    const ct1 = classType("ct1");
    const s1 = session("s1", IN_12H);
    const b1 = booking("b1", "s1", "m1");

    repos = createInMemoryRepositories(
      baseSeed({
        members: [m1],
        classTypes: [ct1],
        sessions: [s1],
        bookings: [b1],
      }),
    );

    const result = await runReminders(repos, "s1", { now: () => ISO });

    expect(result).toEqual({ queued: 1, skipped: 0 });

    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders).toHaveLength(1);
    expect(reminders[0].kind).toBe("booking_reminder");
    expect(reminders[0].memberId).toBe("m1");
    const payload = JSON.parse(reminders[0].payload);
    expect(payload.data.bookingId).toBe("b1");
  });

  it("skips waitlisted members", async () => {
    const m1 = member("m1");
    const ct1 = classType("ct1");
    const s1 = session("s1", IN_12H);
    const b1 = booking("b1", "s1", "m1", { status: "waitlisted" });

    repos = createInMemoryRepositories(
      baseSeed({
        members: [m1],
        classTypes: [ct1],
        sessions: [s1],
        bookings: [b1],
      }),
    );

    const result = await runReminders(repos, "s1", { now: () => ISO });

    expect(result).toEqual({ queued: 0, skipped: 1 });

    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders).toHaveLength(0);
  });

  it("skips members who opted out of notifications", async () => {
    const m1 = member("m1", { notificationsOptedOut: true });
    const ct1 = classType("ct1");
    const s1 = session("s1", IN_12H);
    const b1 = booking("b1", "s1", "m1");

    repos = createInMemoryRepositories(
      baseSeed({
        members: [m1],
        classTypes: [ct1],
        sessions: [s1],
        bookings: [b1],
      }),
    );

    const result = await runReminders(repos, "s1", { now: () => ISO });

    expect(result).toEqual({ queued: 0, skipped: 1 });

    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders).toHaveLength(0);
  });

  it("skips sessions outside the 24h window", async () => {
    const m1 = member("m1");
    const ct1 = classType("ct1");
    const s1 = session("s1", IN_25H);
    const b1 = booking("b1", "s1", "m1");

    repos = createInMemoryRepositories(
      baseSeed({
        members: [m1],
        classTypes: [ct1],
        sessions: [s1],
        bookings: [b1],
      }),
    );

    const result = await runReminders(repos, "s1", { now: () => ISO });

    expect(result).toEqual({ queued: 0, skipped: 0 });

    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders).toHaveLength(0);
  });

  it("is idempotent: a second run queues no duplicate for a booking that already has a reminder", async () => {
    const m1 = member("m1");
    const ct1 = classType("ct1");
    const s1 = session("s1", IN_12H);
    const b1 = booking("b1", "s1", "m1");

    repos = createInMemoryRepositories(
      baseSeed({
        members: [m1],
        classTypes: [ct1],
        sessions: [s1],
        bookings: [b1],
      }),
    );

    const result1 = await runReminders(repos, "s1", { now: () => ISO });
    expect(result1).toEqual({ queued: 1, skipped: 0 });

    const reminders1 = await repos.outbox.listByKind("booking_reminder");
    expect(reminders1).toHaveLength(1);

    const result2 = await runReminders(repos, "s1", { now: () => ISO });
    expect(result2).toEqual({ queued: 0, skipped: 1 });

    const reminders2 = await repos.outbox.listByKind("booking_reminder");
    expect(reminders2).toHaveLength(1);
  });

  it("handles multiple members and sessions correctly", async () => {
    const m1 = member("m1");
    const m2 = member("m2");
    const ct1 = classType("ct1");
    const s1 = session("s1", IN_12H);
    const s2 = session("s2", IN_12H);
    const b1 = booking("b1", "s1", "m1");
    const b2 = booking("b2", "s1", "m2");
    const b3 = booking("b3", "s2", "m1");

    repos = createInMemoryRepositories(
      baseSeed({
        members: [m1, m2],
        classTypes: [ct1],
        sessions: [s1, s2],
        bookings: [b1, b2, b3],
      }),
    );

    const result = await runReminders(repos, "s1", { now: () => ISO });

    expect(result).toEqual({ queued: 3, skipped: 0 });

    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders).toHaveLength(3);
  });
});
