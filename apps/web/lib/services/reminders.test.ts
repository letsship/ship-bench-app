import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { runReminders } from "./reminders";

// Fixed clock: the service takes `now` by injection, so the fixtures can use
// absolute instants instead of chasing the real clock.
const NOW = "2026-03-15T12:00:00.000Z";
const IN_2H = "2026-03-15T14:00:00.000Z";
const IN_23H = "2026-03-16T11:00:00.000Z";
const IN_30H = "2026-03-16T18:00:00.000Z";
const YESTERDAY = "2026-03-14T12:00:00.000Z";
const now = (): string => NOW;

const member = (id: string, over: Partial<Member> = {}): Member => ({
  id,
  studioId: "s1",
  name: id,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: NOW,
  ...over,
});

const session = (id: string, startsAt: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "I",
  startsAt,
  endsAt: startsAt,
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: NOW,
  ...over,
});

const booking = (id: string, memberId: string, sessionId: string, status = "booked"): Booking => ({
  id,
  sessionId,
  memberId,
  status,
  bookedAt: NOW,
  cancelledAt: null,
});

function seedWith(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "UTC", createdAt: NOW },
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
    members: [member("m1"), member("m2")],
    classTypes: [
      {
        id: "ct1",
        studioId: "s1",
        name: "Yoga",
        description: null,
        color: "#111111",
        defaultCapacity: 10,
        defaultPriceCents: 1000,
        createdAt: NOW,
      },
    ],
    sessions: [session("cs1", IN_2H)],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

const run = (repos: Repositories) => runReminders(repos, createFakeProvider(), { now });

describe("runReminders", () => {
  it("queues a pending booking_reminder for each confirmed seat in the next 24h", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        sessions: [session("cs1", IN_2H), session("cs2", IN_23H)],
        bookings: [booking("b1", "m1", "cs1"), booking("b2", "m2", "cs2")],
      }),
    );

    expect(await run(repos)).toEqual({ queued: 2, skipped: 0 });

    const rows = await repos.outbox.listByKind("booking_reminder");
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.sentAt === null)).toBe(true);
    const payload = JSON.parse(rows[0].payload) as { data: Record<string, unknown> };
    expect(payload.data.bookingId).toBe("b1");
    expect(payload.data.sessionId).toBe("cs1");
  });

  it("skips waitlisted seats", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        bookings: [booking("b1", "m1", "cs1"), booking("b2", "m2", "cs1", "waitlisted")],
      }),
    );

    expect(await run(repos)).toEqual({ queued: 1, skipped: 0 });
    const rows = await repos.outbox.listByKind("booking_reminder");
    expect(rows.map((row) => row.memberId)).toEqual(["m1"]);
  });

  it("skips sessions outside the 24-hour window, in the past, or cancelled", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        sessions: [
          session("cs1", IN_30H),
          session("cs2", YESTERDAY),
          session("cs3", IN_2H, { status: "cancelled" }),
        ],
        bookings: [
          booking("b1", "m1", "cs1"),
          booking("b2", "m1", "cs2"),
          booking("b3", "m2", "cs3"),
        ],
      }),
    );

    expect(await run(repos)).toEqual({ queued: 0, skipped: 0 });
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(0);
  });

  it("skips members who opted out of notifications", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        members: [member("m1", { notificationsOptedOut: true }), member("m2")],
        bookings: [booking("b1", "m1", "cs1"), booking("b2", "m2", "cs1")],
      }),
    );

    expect(await run(repos)).toEqual({ queued: 1, skipped: 1 });
    const rows = await repos.outbox.listByKind("booking_reminder");
    expect(rows.map((row) => row.memberId)).toEqual(["m2"]);
  });

  it("is idempotent: a second run queues nothing new", async () => {
    const repos = createInMemoryRepositories(seedWith({ bookings: [booking("b1", "m1", "cs1")] }));

    expect(await run(repos)).toEqual({ queued: 1, skipped: 0 });
    expect(await run(repos)).toEqual({ queued: 0, skipped: 1 });
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(1);
  });

  it("does not re-queue a reminder that was already dispatched", async () => {
    const repos = createInMemoryRepositories(seedWith({ bookings: [booking("b1", "m1", "cs1")] }));
    await run(repos);
    const [row] = await repos.outbox.listByKind("booking_reminder");
    await repos.outbox.update(row.id, { sentAt: NOW, providerMessageId: "pm_1" });

    expect(await run(repos)).toEqual({ queued: 0, skipped: 1 });
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(1);
  });

  it("still queues other bookings in the same session as an already-reminded one", async () => {
    const repos = createInMemoryRepositories(seedWith({ bookings: [booking("b1", "m1", "cs1")] }));
    await run(repos);

    await repos.bookings.insert(booking("b2", "m2", "cs1"));
    expect(await run(repos)).toEqual({ queued: 1, skipped: 1 });
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(2);
  });
});
