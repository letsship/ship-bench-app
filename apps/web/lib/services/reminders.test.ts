import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { runReminders } from "./reminders";

// Fixed clock injected via options.now, so the 24h window is deterministic.
const NOW = new Date("2026-03-15T12:00:00.000Z");
const ISO = NOW.toISOString();
const now = (): string => ISO;
const IN_WINDOW = new Date(NOW.getTime() + 2 * 3_600_000).toISOString();
const IN_WINDOW_END = new Date(NOW.getTime() + 3 * 3_600_000).toISOString();
const OUTSIDE = new Date(NOW.getTime() + 3 * 86_400_000).toISOString();
const OUTSIDE_END = new Date(NOW.getTime() + 3 * 86_400_000 + 3_600_000).toISOString();

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
      notifyBookingReminders: true,
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

function fixture(over: Partial<SeedData> = {}): Repositories {
  return createInMemoryRepositories(
    baseSeed({ classTypes: [classType("ct1")], sessions: [session("cs1")], ...over }),
  );
}

describe("runReminders", () => {
  it("queues a pending booking_reminder per confirmed seat in the 24h window", async () => {
    const repos = fixture({
      members: [member("m1"), member("m2")],
      bookings: [booking("b1", "m1"), booking("b2", "m2")],
    });
    const summary = await runReminders(repos, { now });
    expect(summary).toEqual({ queued: 2, skipped: 0 });
    const rows = await repos.outbox.listByKind("booking_reminder");
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.sentAt === null)).toBe(true);
    expect(rows.map((row) => row.memberId).sort()).toEqual(["m1", "m2"]);
  });

  it("skips waitlisted bookings (no confirmed seat)", async () => {
    const repos = fixture({
      members: [member("m1"), member("m2")],
      bookings: [booking("b1", "m1"), booking("b2", "m2", { status: "waitlisted" })],
    });
    const summary = await runReminders(repos, { now });
    expect(summary.queued).toBe(1);
    const rows = await repos.outbox.listByKind("booking_reminder");
    expect(rows.map((row) => row.memberId)).toEqual(["m1"]);
  });

  it("skips members who have opted out of notifications", async () => {
    const repos = fixture({
      members: [member("m1"), member("m2", { notificationsOptedOut: true })],
      bookings: [booking("b1", "m1"), booking("b2", "m2")],
    });
    const summary = await runReminders(repos, { now });
    expect(summary).toEqual({ queued: 1, skipped: 1 });
    const rows = await repos.outbox.listByKind("booking_reminder");
    expect(rows.map((row) => row.memberId)).toEqual(["m1"]);
  });

  it("skips sessions outside the 24-hour window", async () => {
    const repos = fixture({
      sessions: [session("cs1", { startsAt: OUTSIDE, endsAt: OUTSIDE_END })],
      members: [member("m1")],
      bookings: [booking("b1", "m1")],
    });
    const summary = await runReminders(repos, { now });
    expect(summary).toEqual({ queued: 0, skipped: 0 });
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(0);
  });

  it("queues nothing on a second run (idempotent)", async () => {
    const repos = fixture({
      members: [member("m1")],
      bookings: [booking("b1", "m1")],
    });
    const first = await runReminders(repos, { now });
    expect(first).toEqual({ queued: 1, skipped: 0 });
    const second = await runReminders(repos, { now });
    expect(second).toEqual({ queued: 0, skipped: 1 });
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(1);
  });

  it("an already-delivered reminder still blocks a re-queue", async () => {
    const repos = fixture({
      members: [member("m1")],
      bookings: [booking("b1", "m1")],
    });
    await runReminders(repos, { now });
    const [row] = await repos.outbox.listByKind("booking_reminder");
    await repos.outbox.update(row.id, { sentAt: ISO, providerMessageId: "re_x" });
    const second = await runReminders(repos, { now });
    expect(second.queued).toBe(0);
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(1);
  });

  it("persists data.bookingId on the reminder row (the idempotency key)", async () => {
    const repos = fixture({
      members: [member("m1")],
      bookings: [booking("b1", "m1")],
    });
    await runReminders(repos, { now });
    const [row] = await repos.outbox.listByKind("booking_reminder");
    expect(row.kind).toBe("booking_reminder");
    const payload = JSON.parse(row.payload) as { data: Record<string, unknown> };
    expect(payload.data).toMatchObject({ bookingId: "b1", title: "Yoga", startsAt: IN_WINDOW });
  });
});
