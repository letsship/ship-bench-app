import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, Member } from "@/lib/db/types";
import { runBookingReminders } from "./reminders";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const ISO = NOW.toISOString();
const now = () => ISO;
const at = (hours: number): string => new Date(NOW.getTime() + hours * 3_600_000).toISOString();

function member(id: string, overrides: Partial<Member> = {}): Member {
  return {
    id,
    studioId: "s1",
    name: `Member ${id}`,
    email: `${id}@example.com`,
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: ISO,
    ...overrides,
  };
}

function session(id: string, startsInHours: number, overrides: Partial<ClassSession> = {}) {
  return {
    id,
    studioId: "s1",
    classTypeId: "ct1",
    instructor: "Ines",
    startsAt: at(startsInHours),
    endsAt: at(startsInHours + 1),
    capacity: 10,
    priceCents: 1800,
    status: "scheduled",
    createdAt: ISO,
    ...overrides,
  };
}

function booking(id: string, sessionId: string, memberId: string, status = "booked"): Booking {
  return { id, sessionId, memberId, status, bookedAt: ISO, cancelledAt: null };
}

function seed(over: Partial<SeedData> = {}): SeedData {
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
    classTypes: [
      {
        id: "ct1",
        studioId: "s1",
        name: "Vinyasa Flow",
        description: null,
        color: "#111",
        defaultCapacity: 10,
        defaultPriceCents: 1800,
        createdAt: ISO,
      },
    ],
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

describe("runBookingReminders", () => {
  it("queues a pending booking_reminder for a confirmed seat inside the window", async () => {
    const repos = createInMemoryRepositories(
      seed({
        members: [member("m1")],
        sessions: [session("sess1", 6)],
        bookings: [booking("b1", "sess1", "m1")],
      }),
    );

    expect(await runBookingReminders(repos, { now })).toEqual({ queued: 1 });

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe("booking_reminder");
    expect(pending[0].memberId).toBe("m1");
    expect(pending[0].sentAt).toBeNull();
    const payload = JSON.parse(pending[0].payload) as {
      subject: string;
      data: { bookingId: string; title: string };
    };
    expect(payload.data.bookingId).toBe("b1");
    expect(payload.data.title).toBe("Vinyasa Flow");
    expect(payload.subject).toContain("Vinyasa Flow");
  });

  it("skips waitlisted, cancelled and opted-out bookings", async () => {
    const repos = createInMemoryRepositories(
      seed({
        members: [member("m1"), member("m2"), member("m3", { notificationsOptedOut: true })],
        sessions: [session("sess1", 6)],
        bookings: [
          booking("b1", "sess1", "m1", "waitlisted"),
          booking("b2", "sess1", "m2", "cancelled"),
          booking("b3", "sess1", "m3"),
        ],
      }),
    );

    expect(await runBookingReminders(repos, { now })).toEqual({ queued: 0 });
    expect(await repos.outbox.listPending()).toHaveLength(0);
  });

  it("ignores sessions outside the next 24 hours and cancelled sessions", async () => {
    const repos = createInMemoryRepositories(
      seed({
        members: [member("m1"), member("m2"), member("m3")],
        sessions: [
          session("past", -2),
          session("late", 30),
          session("cancelled", 5, { status: "cancelled" }),
        ],
        bookings: [
          booking("b1", "past", "m1"),
          booking("b2", "late", "m2"),
          booking("b3", "cancelled", "m3"),
        ],
      }),
    );

    expect(await runBookingReminders(repos, { now })).toEqual({ queued: 0 });
    expect(await repos.outbox.listPending()).toHaveLength(0);
  });

  it("is idempotent across repeated runs, even after the reminder was sent", async () => {
    const repos = createInMemoryRepositories(
      seed({
        members: [member("m1")],
        sessions: [session("sess1", 6)],
        bookings: [booking("b1", "sess1", "m1")],
      }),
    );

    expect(await runBookingReminders(repos, { now })).toEqual({ queued: 1 });
    expect(await runBookingReminders(repos, { now })).toEqual({ queued: 0 });
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(1);

    // Once dispatch stamps sentAt the row leaves listPending — it must still
    // suppress a re-queue.
    const [row] = await repos.outbox.listPending();
    await repos.outbox.update(row.id, { sentAt: at(1), providerMessageId: "p_1" });

    expect(await runBookingReminders(repos, { now })).toEqual({ queued: 0 });
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(1);
  });

  it("still reminds a booking added after an earlier run", async () => {
    const repos = createInMemoryRepositories(
      seed({
        members: [member("m1"), member("m2")],
        sessions: [session("sess1", 6)],
        bookings: [booking("b1", "sess1", "m1")],
      }),
    );

    expect(await runBookingReminders(repos, { now })).toEqual({ queued: 1 });
    await repos.bookings.insert(booking("b2", "sess1", "m2"));
    expect(await runBookingReminders(repos, { now })).toEqual({ queued: 1 });
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(2);
  });
});
