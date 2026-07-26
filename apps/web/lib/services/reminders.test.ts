import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { sendClassReminders } from "./reminders";

const NOW = "2026-03-15T12:00:00.000Z";
const nowFn = () => NOW;
const WITHIN_WINDOW = "2026-03-16T00:00:00.000Z"; // +12h
const OUTSIDE_WINDOW = "2026-03-17T00:00:00.000Z"; // +36h

function baseSeed(over: Partial<SeedData> = {}): SeedData {
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

const classType = (id: string): ClassType => ({
  id,
  studioId: "s1",
  name: "Yoga",
  description: null,
  color: "#111111",
  defaultCapacity: 10,
  defaultPriceCents: 1000,
  createdAt: NOW,
});

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

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "I",
  startsAt: WITHIN_WINDOW,
  endsAt: WITHIN_WINDOW,
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: NOW,
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
  bookedAt: NOW,
  cancelledAt: null,
  ...over,
});

describe("sendClassReminders", () => {
  let repos: Repositories;

  it("queues a reminder for a confirmed seat in the next 24 hours", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1")],
        sessions: [session("cs1")],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );
    const summary = await sendClassReminders(repos, { now: nowFn });
    expect(summary.queued).toBe(1);
    const outbox = await repos.outbox.listByKind("booking_reminder");
    expect(outbox).toHaveLength(1);
    expect(outbox[0].memberId).toBe("m1");
    expect(outbox[0].sentAt).toBeNull();
    expect(JSON.parse(outbox[0].payload).data.bookingId).toBe("b1");
  });

  it("skips a waitlisted member", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1")],
        sessions: [session("cs1")],
        bookings: [booking("b1", "cs1", "m1", { status: "waitlisted" })],
      }),
    );
    const summary = await sendClassReminders(repos, { now: nowFn });
    expect(summary.queued).toBe(0);
  });

  it("skips a session outside the 24-hour window", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1")],
        sessions: [session("cs1", { startsAt: OUTSIDE_WINDOW, endsAt: OUTSIDE_WINDOW })],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );
    const summary = await sendClassReminders(repos, { now: nowFn });
    expect(summary.queued).toBe(0);
  });

  it("skips a member who opted out of notifications", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1", { notificationsOptedOut: true })],
        sessions: [session("cs1")],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );
    const summary = await sendClassReminders(repos, { now: nowFn });
    expect(summary.queued).toBe(0);
  });

  it("skips a cancelled session", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1")],
        sessions: [session("cs1", { status: "cancelled" })],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );
    const summary = await sendClassReminders(repos, { now: nowFn });
    expect(summary.queued).toBe(0);
  });

  it("is idempotent across repeated runs", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1")],
        sessions: [session("cs1")],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );
    await sendClassReminders(repos, { now: nowFn });
    const second = await sendClassReminders(repos, { now: nowFn });
    expect(second.queued).toBe(0);
    const outbox = await repos.outbox.listByKind("booking_reminder");
    expect(outbox).toHaveLength(1);
  });
});
