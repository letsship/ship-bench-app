import { describe, expect, it } from "vitest";
import { createInMemoryRepositories, type SeedData } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, Member } from "@/lib/db/types";
import { runReminders } from "./reminders";

const NOW = "2026-03-15T12:00:00.000Z";
const now = () => NOW;
const plusHours = (hours: number): string =>
  new Date(new Date(NOW).getTime() + hours * 3_600_000).toISOString();

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
  instructor: "Noor",
  startsAt,
  endsAt: new Date(new Date(startsAt).getTime() + 3_600_000).toISOString(),
  capacity: 10,
  priceCents: 1800,
  status: "scheduled",
  createdAt: NOW,
  ...over,
});

const booking = (id: string, sessionId: string, memberId: string, status = "booked"): Booking => ({
  id,
  sessionId,
  memberId,
  status,
  bookedAt: NOW,
  cancelledAt: null,
});

function seedWith(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: NOW },
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
      notifyClassReminders: true,
    },
    members: [],
    classTypes: [
      {
        id: "ct1",
        studioId: "s1",
        name: "Vinyasa Flow",
        description: null,
        color: "#5b8c5a",
        defaultCapacity: 10,
        defaultPriceCents: 1800,
        createdAt: NOW,
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

const reminderRows = (repos: Repositories) => repos.outbox.listByKind("booking_reminder");

describe("runReminders", () => {
  it("queues a pending reminder for every confirmed seat in the next 24 hours", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        members: [member("m1"), member("m2")],
        sessions: [session("sess1", plusHours(6))],
        bookings: [booking("b1", "sess1", "m1"), booking("b2", "sess1", "m2")],
      }),
    );

    expect(await runReminders(repos, { now })).toEqual({ queued: 2 });

    const rows = await reminderRows(repos);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.sentAt === null)).toBe(true);
    expect(rows.map((row) => row.memberId).sort()).toEqual(["m1", "m2"]);

    const payload = JSON.parse(rows[0].payload) as { data: { bookingId: string; title: string } };
    expect(payload.data.bookingId).toBe("b1");
    expect(payload.data.title).toBe("Vinyasa Flow");
  });

  it("skips waitlisted and cancelled seats", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        members: [member("m1"), member("m2"), member("m3")],
        sessions: [session("sess1", plusHours(6))],
        bookings: [
          booking("b1", "sess1", "m1"),
          booking("b2", "sess1", "m2", "waitlisted"),
          booking("b3", "sess1", "m3", "cancelled"),
        ],
      }),
    );

    expect(await runReminders(repos, { now })).toEqual({ queued: 1 });
    expect((await reminderRows(repos)).map((row) => row.memberId)).toEqual(["m1"]);
  });

  it("skips members who opted out of notifications", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        members: [member("m1", { notificationsOptedOut: true }), member("m2")],
        sessions: [session("sess1", plusHours(6))],
        bookings: [booking("b1", "sess1", "m1"), booking("b2", "sess1", "m2")],
      }),
    );

    expect(await runReminders(repos, { now })).toEqual({ queued: 1 });
    expect((await reminderRows(repos)).map((row) => row.memberId)).toEqual(["m2"]);
  });

  it("skips sessions outside the 24-hour window", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        members: [member("m1"), member("m2"), member("m3")],
        sessions: [
          session("past", plusHours(-2)),
          session("soon", plusHours(3)),
          session("later", plusHours(30)),
        ],
        bookings: [
          booking("b1", "past", "m1"),
          booking("b2", "soon", "m2"),
          booking("b3", "later", "m3"),
        ],
      }),
    );

    expect(await runReminders(repos, { now })).toEqual({ queued: 1 });
    expect((await reminderRows(repos)).map((row) => row.memberId)).toEqual(["m2"]);
  });

  it("skips cancelled sessions", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        members: [member("m1")],
        sessions: [session("sess1", plusHours(6), { status: "cancelled" })],
        bookings: [booking("b1", "sess1", "m1")],
      }),
    );

    expect(await runReminders(repos, { now })).toEqual({ queued: 0 });
    expect(await reminderRows(repos)).toHaveLength(0);
  });

  it("is idempotent — a second run queues no duplicates", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        members: [member("m1"), member("m2")],
        sessions: [session("sess1", plusHours(6))],
        bookings: [booking("b1", "sess1", "m1"), booking("b2", "sess1", "m2")],
      }),
    );

    expect(await runReminders(repos, { now })).toEqual({ queued: 2 });
    expect(await runReminders(repos, { now })).toEqual({ queued: 0 });
    expect(await reminderRows(repos)).toHaveLength(2);
  });

  it("does not re-queue a reminder that has already been dispatched", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        members: [member("m1")],
        sessions: [session("sess1", plusHours(6))],
        bookings: [booking("b1", "sess1", "m1")],
      }),
    );
    await runReminders(repos, { now });
    const [row] = await reminderRows(repos);
    await repos.outbox.update(row.id, { sentAt: NOW, providerMessageId: "re_1" });

    expect(await runReminders(repos, { now })).toEqual({ queued: 0 });
    expect(await reminderRows(repos)).toHaveLength(1);
  });

  it("still reminds a newly booked seat on a later run", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        members: [member("m1"), member("m2")],
        sessions: [session("sess1", plusHours(6))],
        bookings: [booking("b1", "sess1", "m1")],
      }),
    );
    await runReminders(repos, { now });
    await repos.bookings.insert(booking("b2", "sess1", "m2"));

    expect(await runReminders(repos, { now })).toEqual({ queued: 1 });
    expect((await reminderRows(repos)).map((row) => row.memberId)).toEqual(["m1", "m2"]);
  });
});
