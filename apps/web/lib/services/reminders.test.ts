import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { runReminders } from "./reminders";

const NOW_ISO = "2026-03-15T12:00:00.000Z";
const NOW = () => NOW_ISO;

function baseSeed(over: Partial<SeedData> = {}): SeedData {
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
  createdAt: NOW_ISO,
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
  createdAt: NOW_ISO,
});

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "I",
  startsAt: "2026-03-16T10:00:00.000Z", // ~22h ahead of NOW
  endsAt: "2026-03-16T11:00:00.000Z",
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: NOW_ISO,
  ...over,
});

const booking = (id: string, sessionId: string, memberId: string, status = "booked"): Booking => ({
  id,
  sessionId,
  memberId,
  status,
  bookedAt: NOW_ISO,
  cancelledAt: null,
});

function payloadData(row: { payload: string }): Record<string, unknown> | undefined {
  return (JSON.parse(row.payload) as { data?: Record<string, unknown> }).data;
}

describe("runReminders", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1"), member("m2", { notificationsOptedOut: true }), member("m3")],
        sessions: [session("s_in")],
        bookings: [
          booking("b1", "s_in", "m1"), // confirmed → reminded
          booking("b2", "s_in", "m2"), // opted out → skipped
          booking("b3", "s_in", "m3", "waitlisted"), // waitlisted → skipped
        ],
      }),
    );
  });

  it("queues one pending booking_reminder per confirmed, opted-in booking", async () => {
    const summary = await runReminders(repos, "s1", { now: NOW });
    expect(summary).toEqual({ queued: 1, skipped: 1 });

    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders).toHaveLength(1);
    const row = reminders[0];
    expect(row.sentAt).toBeNull();
    expect(row.memberId).toBe("m1");
    expect(payloadData(row)?.bookingId).toBe("b1");
  });

  it("is idempotent: a second run queues no duplicates", async () => {
    await runReminders(repos, "s1", { now: NOW });
    const second = await runReminders(repos, "s1", { now: NOW });
    expect(second).toEqual({ queued: 0, skipped: 2 });
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(1);
  });

  it("does not re-queue a booking whose reminder was already dispatched", async () => {
    await runReminders(repos, "s1", { now: NOW });
    const [row] = await repos.outbox.listByKind("booking_reminder");
    await repos.outbox.update(row.id, {
      sentAt: NOW_ISO,
      providerMessageId: "prov_1",
      error: null,
    });
    const second = await runReminders(repos, "s1", { now: NOW });
    expect(second.queued).toBe(0);
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(1);
  });

  it("skips opted-out members", async () => {
    const summary = await runReminders(repos, "s1", { now: NOW });
    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders.every((row) => row.memberId !== "m2")).toBe(true);
    expect(summary.skipped).toBe(1);
  });

  it("skips waitlisted seats", async () => {
    await runReminders(repos, "s1", { now: NOW });
    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders.some((row) => payloadData(row)?.bookingId === "b3")).toBe(false);
  });

  it("ignores sessions starting outside the 24h window", async () => {
    const far = session("s_far", {
      startsAt: "2026-03-17T13:00:00.000Z", // >24h ahead
      endsAt: "2026-03-17T14:00:00.000Z",
    });
    await repos.classSessions.insert(far);
    await repos.bookings.insert(booking("b_far", "s_far", "m1"));

    const summary = await runReminders(repos, "s1", { now: NOW });
    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders.some((row) => payloadData(row)?.bookingId === "b_far")).toBe(false);
    expect(summary.queued).toBe(1);
  });

  it("ignores sessions that are not scheduled", async () => {
    const cancelled = session("s_cx", { status: "cancelled" });
    await repos.classSessions.insert(cancelled);
    await repos.bookings.insert(booking("b_cx", "s_cx", "m1"));

    await runReminders(repos, "s1", { now: NOW });
    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders.some((row) => payloadData(row)?.bookingId === "b_cx")).toBe(false);
  });

  it("includes a session starting exactly at the window end boundary? no — exclusive", async () => {
    // 24h ahead is the exclusive upper bound: a session starting exactly then
    // is NOT within the window.
    const edge = session("s_edge", {
      startsAt: "2026-03-16T12:00:00.000Z",
      endsAt: "2026-03-16T13:00:00.000Z",
    });
    await repos.classSessions.insert(edge);
    await repos.bookings.insert(booking("b_edge", "s_edge", "m1"));

    const summary = await runReminders(repos, "s1", { now: NOW });
    expect(summary.queued).toBe(1); // only b1
    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders.some((row) => payloadData(row)?.bookingId === "b_edge")).toBe(false);
  });
});
