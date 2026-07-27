import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { queueClassReminders } from "./reminders";

const NOW = new Date("2026-07-27T12:00:00.000Z");
const ISO = NOW.toISOString();
const IN_24H = new Date(NOW.getTime() + 23 * 60 * 60 * 1000).toISOString();
const IN_24H_END = new Date(NOW.getTime() + 24 * 60 * 60 * 1000).toISOString();
const AFTER_24H = new Date(NOW.getTime() + 25 * 60 * 60 * 1000).toISOString();
const AFTER_24H_END = new Date(NOW.getTime() + 26 * 60 * 60 * 1000).toISOString();

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
  startsAt: IN_24H,
  endsAt: IN_24H_END,
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

describe("queueClassReminders", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories();
  });

  it("queues one reminder per confirmed booking in the 24h window", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1"), member("m2")],
        sessions: [session("cs1")],
        bookings: [booking("b1", "m1"), booking("b2", "m2")],
      }),
    );

    const result = await queueClassReminders(repos, "s1", { now: () => ISO });
    expect(result.queued).toBe(2);

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(2);
    expect(pending[0].kind).toBe("booking_reminder");
    expect(pending[1].kind).toBe("booking_reminder");
  });

  it("excludes waitlisted bookings", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1"), member("m2")],
        sessions: [session("cs1")],
        bookings: [booking("b1", "m1"), booking("b2", "m2", { status: "waitlisted" })],
      }),
    );

    const result = await queueClassReminders(repos, "s1", { now: () => ISO });
    expect(result.queued).toBe(1);

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(1);
  });

  it("excludes sessions outside the 24h window", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1"), member("m2")],
        sessions: [session("cs1"), session("cs2", { startsAt: AFTER_24H, endsAt: AFTER_24H_END })],
        bookings: [booking("b1", "m1"), booking("b2", "m2", { sessionId: "cs2" })],
      }),
    );

    const result = await queueClassReminders(repos, "s1", { now: () => ISO });
    expect(result.queued).toBe(1);

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(1);
  });

  it("excludes members who have opted out", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1"), member("m2", { notificationsOptedOut: true })],
        sessions: [session("cs1")],
        bookings: [booking("b1", "m1"), booking("b2", "m2")],
      }),
    );

    const result = await queueClassReminders(repos, "s1", { now: () => ISO });
    expect(result.queued).toBe(1);

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(1);
  });

  it("is idempotent: second run queues zero duplicates", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1")],
        sessions: [session("cs1")],
        bookings: [booking("b1", "m1")],
      }),
    );

    const result1 = await queueClassReminders(repos, "s1", { now: () => ISO });
    expect(result1.queued).toBe(1);

    const result2 = await queueClassReminders(repos, "s1", { now: () => ISO });
    expect(result2.queued).toBe(0);

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(1);
  });

  it("excludes cancelled sessions", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1")],
        sessions: [session("cs1", { status: "cancelled" })],
        bookings: [booking("b1", "m1")],
      }),
    );

    const result = await queueClassReminders(repos, "s1", { now: () => ISO });
    expect(result.queued).toBe(0);

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(0);
  });

  it("does not dispatch reminders", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1")],
        sessions: [session("cs1")],
        bookings: [booking("b1", "m1")],
      }),
    );

    await queueClassReminders(repos, "s1", { now: () => ISO });

    const allRows = await repos.outbox.listByKind("booking_reminder");
    expect(allRows).toHaveLength(1);
    expect(allRows[0].sentAt).toBeNull();
  });
});
