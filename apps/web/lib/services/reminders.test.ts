import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, Member, NotificationOutboxRow } from "@/lib/db/types";
import { runReminders } from "./reminders";

// The window is pinned by injecting `now`, so fixtures are fixed instants.
const ISO = "2026-03-15T12:00:00.000Z";
const now = (): string => ISO;
const IN_WINDOW = "2026-03-15T18:00:00.000Z";
const IN_WINDOW_END = "2026-03-15T19:00:00.000Z";
const AFTER_WINDOW = "2026-03-16T18:00:00.000Z";
const AFTER_WINDOW_END = "2026-03-16T19:00:00.000Z";

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

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "I",
  startsAt: IN_WINDOW,
  endsAt: IN_WINDOW_END,
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

function seedWith(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "UTC", createdAt: ISO },
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
    members: [member("m1")],
    classTypes: [
      {
        id: "ct1",
        studioId: "s1",
        name: "Yoga",
        description: null,
        color: "#111111",
        defaultCapacity: 10,
        defaultPriceCents: 1000,
        createdAt: ISO,
      },
    ],
    sessions: [session("cs1")],
    bookings: [booking("b1", "m1")],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

const outboxRows = async (repos: Repositories): Promise<NotificationOutboxRow[]> =>
  repos.outbox.listByKind("booking_reminder");

describe("runReminders", () => {
  it("queues one pending booking_reminder per confirmed seat in the next 24h", async () => {
    const repos = createInMemoryRepositories(seedWith());
    const summary = await runReminders(repos, "s1", { now });

    expect(summary).toEqual({ queued: 1 });
    const rows = await outboxRows(repos);
    expect(rows).toHaveLength(1);
    expect(rows[0].sentAt).toBeNull();
    const payload = JSON.parse(rows[0].payload) as {
      data: { bookingId: string; title: string };
    };
    expect(payload.data.bookingId).toBe("b1");
    expect(payload.data.title).toBe("Yoga");
  });

  it("skips waitlisted seats and opted-out members", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        members: [member("m1"), member("m2"), member("m3", { notificationsOptedOut: true })],
        bookings: [
          booking("b1", "m1"),
          booking("b2", "m2", { status: "waitlisted" }),
          booking("b3", "m3"),
        ],
      }),
    );
    const summary = await runReminders(repos, "s1", { now });

    expect(summary).toEqual({ queued: 1 });
    const rows = await outboxRows(repos);
    expect(rows).toHaveLength(1);
    expect((JSON.parse(rows[0].payload) as { data: { bookingId: string } }).data.bookingId).toBe(
      "b1",
    );
  });

  it("skips sessions outside the 24h window", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        sessions: [
          session("cs1"),
          session("cs2", { startsAt: AFTER_WINDOW, endsAt: AFTER_WINDOW_END }),
        ],
        bookings: [booking("b1", "m1"), booking("b2", "m1", { sessionId: "cs2" })],
      }),
    );
    const summary = await runReminders(repos, "s1", { now });

    expect(summary).toEqual({ queued: 1 });
    expect(await outboxRows(repos)).toHaveLength(1);
  });

  it("is idempotent: a second run queues no duplicates", async () => {
    const repos = createInMemoryRepositories(seedWith());
    await runReminders(repos, "s1", { now });

    const summary = await runReminders(repos, "s1", { now });
    expect(summary).toEqual({ queued: 0 });
    expect(await outboxRows(repos)).toHaveLength(1);
  });

  it("stays idempotent after the reminder has been dispatched", async () => {
    const repos = createInMemoryRepositories(seedWith());
    await runReminders(repos, "s1", { now });
    const [row] = await outboxRows(repos);
    await repos.outbox.update(row.id, { sentAt: ISO });

    const summary = await runReminders(repos, "s1", { now });
    expect(summary).toEqual({ queued: 0 });
    expect(await outboxRows(repos)).toHaveLength(1);
  });

  it("still queues new bookings on a re-run when others already have a reminder", async () => {
    const repos = createInMemoryRepositories(seedWith({ members: [member("m1"), member("m2")] }));
    await runReminders(repos, "s1", { now });
    await repos.bookings.insert(booking("b2", "m2"));

    const summary = await runReminders(repos, "s1", { now });
    expect(summary).toEqual({ queued: 1 });
    const remindedIds = (await outboxRows(repos)).map(
      (row) => (JSON.parse(row.payload) as { data: { bookingId: string } }).data.bookingId,
    );
    expect(remindedIds.sort()).toEqual(["b1", "b2"]);
  });
});
