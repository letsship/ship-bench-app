import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { runReminders } from "./reminders";

// Fixed clock for deterministic tests. Sessions will be built relative to this.
const NOW = new Date("2026-03-15T12:00:00.000Z");
const NOW_ISO = NOW.toISOString();

// Helpers for building test fixtures in the style of services.test.ts.
const M1: Member = {
  id: "m1",
  studioId: "s1",
  name: "M1",
  email: "m1@e.co",
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: NOW_ISO,
};
const M2: Member = {
  id: "m2",
  studioId: "s1",
  name: "M2",
  email: "m2@e.co",
  phone: null,
  status: "active",
  notificationsOptedOut: true,
  createdAt: NOW_ISO,
};
const M3: Member = {
  id: "m3",
  studioId: "s1",
  name: "M3",
  email: "m3@e.co",
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: NOW_ISO,
};

const CT: ClassType = {
  id: "ct1",
  studioId: "s1",
  name: "Vinyasa Flow",
  description: null,
  color: "#5b8c5a",
  defaultCapacity: 16,
  defaultPriceCents: 1800,
  createdAt: NOW_ISO,
};

function baseSeed(): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "UTC", createdAt: NOW_ISO },
    settings: {
      studioId: "s1",
      currency: "EUR",
      taxRateBps: 0,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
    members: [M1, M2, M3],
    classTypes: [CT],
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

/** Build a session at the given hour offset from NOW. */
function sessionAt(
  id: string,
  hourOffset: number,
  over: Partial<ClassSession> = {},
): ClassSession {
  const startsAt = new Date(NOW.getTime() + hourOffset * 60 * 60 * 1000);
  return {
    id,
    studioId: "s1",
    classTypeId: "ct1",
    instructor: "I",
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + 3600_000).toISOString(),
    capacity: 10,
    priceCents: 1000,
    status: "scheduled",
    createdAt: NOW_ISO,
    ...over,
  };
}

function booking(
  id: string,
  sessionId: string,
  memberId: string,
  over: Partial<Booking> = {},
): Booking {
  return {
    id,
    sessionId,
    memberId,
    status: "booked",
    bookedAt: NOW_ISO,
    cancelledAt: null,
    ...over,
  };
}

describe("runReminders", () => {
  it("queues one booking_reminder per confirmed booking in a session within 24h", async () => {
    const seed = baseSeed();
    seed.sessions = [sessionAt("cs1", 12)]; // 12 hours from now
    seed.bookings = [booking("b1", "cs1", "m1"), booking("b2", "cs1", "m3")]; // m2 opted out
    const repos = createInMemoryRepositories(seed);

    const queued = await runReminders(repos, "s1", { now: () => NOW_ISO });

    expect(queued).toBe(2);
    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders).toHaveLength(2);
    for (const row of reminders) {
      const payload = JSON.parse(row.payload) as { data?: { bookingId?: string } };
      expect(payload.data?.bookingId).toBeTruthy();
      expect(["b1", "b2"]).toContain(payload.data?.bookingId);
      expect(row.sentAt).toBeNull(); // pending, not sent
      expect(row.kind).toBe("booking_reminder");
    }
  });

  it("skips waitlisted seats", async () => {
    const seed = baseSeed();
    seed.sessions = [sessionAt("cs1", 12)];
    seed.bookings = [
      booking("b1", "cs1", "m1"), // confirmed
      booking("b2", "cs1", "m3", { status: "waitlisted" }), // waitlisted
    ];
    const repos = createInMemoryRepositories(seed);

    const queued = await runReminders(repos, "s1", { now: () => NOW_ISO });

    expect(queued).toBe(1);
    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders).toHaveLength(1);
    const payload = JSON.parse(reminders[0].payload) as { data?: { bookingId?: string } };
    expect(payload.data?.bookingId).toBe("b1");
  });

  it("skips members with notificationsOptedOut", async () => {
    const seed = baseSeed();
    seed.sessions = [sessionAt("cs1", 12)];
    seed.bookings = [
      booking("b1", "cs1", "m1"), // notifications on
      booking("b2", "cs1", "m2"), // opted out
    ];
    const repos = createInMemoryRepositories(seed);

    const queued = await runReminders(repos, "s1", { now: () => NOW_ISO });

    expect(queued).toBe(1);
    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders).toHaveLength(1);
    const payload = JSON.parse(reminders[0].payload) as { data?: { bookingId?: string } };
    expect(payload.data?.bookingId).toBe("b1");
  });

  it("skips sessions outside the 24-hour window (past sessions)", async () => {
    const seed = baseSeed();
    seed.sessions = [
      sessionAt("cs1", -1),  // 1 hour ago — past
      sessionAt("cs2", 12),  // 12 hours from now — within window
    ];
    seed.bookings = [
      booking("b1", "cs1", "m1"),
      booking("b2", "cs2", "m3"),
    ];
    const repos = createInMemoryRepositories(seed);

    const queued = await runReminders(repos, "s1", { now: () => NOW_ISO });

    // Only the future session's booking should get a reminder.
    expect(queued).toBe(1);
    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders).toHaveLength(1);
    const payload = JSON.parse(reminders[0].payload) as { data?: { bookingId?: string } };
    expect(payload.data?.bookingId).toBe("b2");
  });

  it("skips sessions outside the 24-hour window (beyond 24h)", async () => {
    const seed = baseSeed();
    seed.sessions = [
      sessionAt("cs1", 25), // 25 hours from now — beyond window
      sessionAt("cs2", 12), // 12 hours from now — within window
    ];
    seed.bookings = [
      booking("b1", "cs1", "m1"),
      booking("b2", "cs2", "m3"),
    ];
    const repos = createInMemoryRepositories(seed);

    const queued = await runReminders(repos, "s1", { now: () => NOW_ISO });

    expect(queued).toBe(1);
    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders).toHaveLength(1);
    const payload = JSON.parse(reminders[0].payload) as { data?: { bookingId?: string } };
    expect(payload.data?.bookingId).toBe("b2");
  });

  it("is idempotent — second run queues no duplicates", async () => {
    const seed = baseSeed();
    seed.sessions = [sessionAt("cs1", 12)];
    seed.bookings = [booking("b1", "cs1", "m1"), booking("b2", "cs1", "m3")];
    const repos = createInMemoryRepositories(seed);

    // First run queues 2.
    const first = await runReminders(repos, "s1", { now: () => NOW_ISO });
    expect(first).toBe(2);

    // Second run queues 0 — idempotent.
    const second = await runReminders(repos, "s1", { now: () => NOW_ISO });
    expect(second).toBe(0);

    // Still only 2 rows total.
    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders).toHaveLength(2);
  });

  it("returns 0 when no sessions in the window", async () => {
    const seed = baseSeed();
    seed.sessions = [sessionAt("cs1", 25)]; // beyond 24h
    seed.bookings = [booking("b1", "cs1", "m1")];
    const repos = createInMemoryRepositories(seed);

    const queued = await runReminders(repos, "s1", { now: () => NOW_ISO });
    expect(queued).toBe(0);
  });

  it("returns 0 when there are no confirmed bookings", async () => {
    const seed = baseSeed();
    seed.sessions = [sessionAt("cs1", 12)];
    seed.bookings = [booking("b1", "cs1", "m1", { status: "waitlisted" })];
    const repos = createInMemoryRepositories(seed);

    const queued = await runReminders(repos, "s1", { now: () => NOW_ISO });
    expect(queued).toBe(0);
  });
});