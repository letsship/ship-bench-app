import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { runReminders } from "./reminders";

const NOW_ISO = "2026-03-15T12:00:00.000Z";
const NOW = () => NOW_ISO;

const inWindow = (hoursFromNow: number): string =>
  new Date(new Date(NOW_ISO).getTime() + hoursFromNow * 3_600_000).toISOString();

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
    classTypes: [classType("ct1")],
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

function classType(id: string): ClassType {
  return {
    id,
    studioId: "s1",
    name: "Yoga",
    description: null,
    color: "#111111",
    defaultCapacity: 10,
    defaultPriceCents: 1000,
    createdAt: NOW_ISO,
  };
}

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "I",
  startsAt: inWindow(4),
  endsAt: inWindow(5),
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: NOW_ISO,
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
  bookedAt: NOW_ISO,
  cancelledAt: null,
  ...over,
});

describe("runReminders", () => {
  let repos: Repositories;

  it("queues one pending booking_reminder per confirmed booking in the next 24h", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        sessions: [session("cs1")],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );

    const summary = await runReminders(repos, { now: NOW });
    expect(summary).toEqual({ queued: 1 });

    const outbox = await repos.outbox.listByKind("booking_reminder");
    expect(outbox).toHaveLength(1);
    expect(outbox[0].memberId).toBe("m1");
    expect(outbox[0].sentAt).toBeNull();
    const payload = JSON.parse(outbox[0].payload);
    expect(payload.data.bookingId).toBe("b1");
  });

  it("excludes waitlisted bookings", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        sessions: [session("cs1")],
        bookings: [booking("b1", "cs1", "m1", { status: "waitlisted" })],
      }),
    );

    const summary = await runReminders(repos, { now: NOW });
    expect(summary).toEqual({ queued: 0 });
  });

  it("excludes opted-out members", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1", { notificationsOptedOut: true })],
        sessions: [session("cs1")],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );

    const summary = await runReminders(repos, { now: NOW });
    expect(summary).toEqual({ queued: 0 });
  });

  it("excludes bookings for sessions outside the 24h window", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1"), member("m2")],
        sessions: [
          session("cs1", { startsAt: inWindow(30), endsAt: inWindow(31) }),
          session("cs2", { startsAt: inWindow(-1), endsAt: inWindow(0) }),
        ],
        bookings: [booking("b1", "cs1", "m1"), booking("b2", "cs2", "m2")],
      }),
    );

    const summary = await runReminders(repos, { now: NOW });
    expect(summary).toEqual({ queued: 0 });
  });

  it("excludes bookings for cancelled sessions", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        sessions: [session("cs1", { status: "cancelled" })],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );

    const summary = await runReminders(repos, { now: NOW });
    expect(summary).toEqual({ queued: 0 });
  });

  it("is idempotent: a second run queues no duplicate reminder", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        sessions: [session("cs1")],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );

    await runReminders(repos, { now: NOW });
    const second = await runReminders(repos, { now: NOW });
    expect(second).toEqual({ queued: 0 });
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(1);
  });

  it("is idempotent even after the first reminder has already been sent", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        sessions: [session("cs1")],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );

    await runReminders(repos, { now: NOW });
    const [row] = await repos.outbox.listByKind("booking_reminder");
    await repos.outbox.update(row.id, { sentAt: NOW_ISO, providerMessageId: "prov_1" });

    const second = await runReminders(repos, { now: NOW });
    expect(second).toEqual({ queued: 0 });
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(1);
  });

  it("only queues — never dispatches — the reminder", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        sessions: [session("cs1")],
        bookings: [booking("b1", "cs1", "m1")],
      }),
    );

    await runReminders(repos, { now: NOW });
    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].sentAt).toBeNull();
    expect(pending[0].providerMessageId).toBeNull();
  });
});
