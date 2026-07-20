import { describe, expect, it } from "vitest";
import type { SeedData } from "@/lib/db/repos/fakes";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { runReminders } from "./reminders";

const NOW = new Date("2026-03-15T12:00:00.000Z").toISOString();
const IN_24H = new Date(new Date(NOW).getTime() + 23 * 3_600_000).toISOString();
const AFTER_24H = new Date(new Date(NOW).getTime() + 25 * 3_600_000).toISOString();
const BEFORE_NOW = new Date(new Date(NOW).getTime() - 1 * 3_600_000).toISOString();

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
  createdAt: NOW,
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
  createdAt: NOW,
});

const session = (id: string, startsAt: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "I",
  startsAt,
  endsAt: new Date(new Date(startsAt).getTime() + 3_600_000).toISOString(),
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

describe("reminders service", () => {
  it("queues a booking_reminder for a booked member in a session starting inside 24h", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        classTypes: [classType("ct1")],
        sessions: [session("cs1", IN_24H)],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );

    const summary = await runReminders(repos, "s1", { now: () => NOW });
    expect(summary.queued).toBe(1);

    const outbox = await repos.outbox.listByMemberAndKind("m1", "booking_reminder");
    expect(outbox).toHaveLength(1);
    expect(outbox[0].kind).toBe("booking_reminder");
  });

  it("excludes sessions outside the 24-hour window", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        classTypes: [classType("ct1")],
        sessions: [session("cs1", AFTER_24H), session("cs2", BEFORE_NOW)],
        bookings: [booking("b1", "cs1", "m1"), booking("b2", "cs2", "m1")],
      }),
    );

    const summary = await runReminders(repos, "s1", { now: () => NOW });
    expect(summary.queued).toBe(0);
  });

  it("excludes waitlisted bookings", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1"), member("m2")],
        classTypes: [classType("ct1")],
        sessions: [session("cs1", IN_24H)],
        bookings: [
          booking("b1", "cs1", "m1", { status: "waitlisted" }),
          booking("b2", "cs1", "m2"),
        ],
      }),
    );

    const summary = await runReminders(repos, "s1", { now: () => NOW });
    expect(summary.queued).toBe(1);

    const outbox = await repos.outbox.listByMemberAndKind("m1", "booking_reminder");
    expect(outbox).toHaveLength(0);
  });

  it("excludes members with notificationsOptedOut", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1", { notificationsOptedOut: true }), member("m2")],
        classTypes: [classType("ct1")],
        sessions: [session("cs1", IN_24H)],
        bookings: [booking("b1", "cs1", "m1"), booking("b2", "cs1", "m2")],
      }),
    );

    const summary = await runReminders(repos, "s1", { now: () => NOW });
    expect(summary.queued).toBe(1);

    const outbox = await repos.outbox.listByMemberAndKind("m1", "booking_reminder");
    expect(outbox).toHaveLength(0);
  });

  it("is idempotent: calling runReminders twice yields exactly one outbox row per booking", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        classTypes: [classType("ct1")],
        sessions: [session("cs1", IN_24H)],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );

    const summary1 = await runReminders(repos, "s1", { now: () => NOW });
    expect(summary1.queued).toBe(1);

    const summary2 = await runReminders(repos, "s1", { now: () => NOW });
    expect(summary2.queued).toBe(0);

    const outbox = await repos.outbox.listByMemberAndKind("m1", "booking_reminder");
    expect(outbox).toHaveLength(1);
  });

  it("is idempotent even after a reminder is sent", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        classTypes: [classType("ct1")],
        sessions: [session("cs1", IN_24H)],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );

    const summary1 = await runReminders(repos, "s1", { now: () => NOW });
    expect(summary1.queued).toBe(1);

    const outbox1 = await repos.outbox.listByMemberAndKind("m1", "booking_reminder");
    expect(outbox1).toHaveLength(1);

    await repos.outbox.update(outbox1[0].id, { sentAt: NOW });

    const summary2 = await runReminders(repos, "s1", { now: () => NOW });
    expect(summary2.queued).toBe(0);

    const outbox2 = await repos.outbox.listByMemberAndKind("m1", "booking_reminder");
    expect(outbox2).toHaveLength(1);
  });
});
