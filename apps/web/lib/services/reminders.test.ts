import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { runReminders } from "./reminders";

const NOW = new Date();
const ISO = NOW.toISOString();
const IN_12_HOURS = new Date(NOW.getTime() + 12 * 60 * 60 * 1000).toISOString();
const IN_25_HOURS = new Date(NOW.getTime() + 25 * 60 * 60 * 1000).toISOString();

function baseSeed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: "s1", name: "Studio", slug: "s", timezone: "UTC", createdAt: ISO },
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
      notifyReminders: true,
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

const classType = (id: string, name: string = "Yoga"): ClassType => ({
  id,
  studioId: "s1",
  name,
  description: null,
  color: "#111111",
  defaultCapacity: 10,
  defaultPriceCents: 1000,
  createdAt: ISO,
});

const session = (id: string, startsAt: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "Alice",
  startsAt,
  endsAt: new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString(),
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: ISO,
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
  bookedAt: ISO,
  cancelledAt: null,
  ...over,
});

describe("reminders service", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories();
  });

  it("queues reminders for booked members in 24-hour window", async () => {
    const m1 = member("m1");
    const ct1 = classType("ct1", "Yoga");
    const sess1 = session("s1", IN_12_HOURS);
    const book1 = booking("b1", "s1", "m1");

    repos = createInMemoryRepositories(
      baseSeed({
        members: [m1],
        classTypes: [ct1],
        sessions: [sess1],
        bookings: [book1],
      }),
    );

    const result = await runReminders(repos, NOW);
    expect(result.sessionsProcessed).toBe(1);
    expect(result.notificationsQueued).toBe(1);

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe("booking_reminder");
    expect(pending[0].memberId).toBe("m1");
    expect(pending[0].dedupeKey).toBe("booking_reminder:s1:m1");
  });

  it("skips waitlisted members", async () => {
    const m1 = member("m1");
    const ct1 = classType("ct1");
    const sess1 = session("s1", IN_12_HOURS);
    const book1 = booking("b1", "s1", "m1", { status: "waitlisted" });

    repos = createInMemoryRepositories(
      baseSeed({
        members: [m1],
        classTypes: [ct1],
        sessions: [sess1],
        bookings: [book1],
      }),
    );

    const result = await runReminders(repos, NOW);
    expect(result.sessionsProcessed).toBe(1);
    expect(result.notificationsQueued).toBe(0);

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(0);
  });

  it("skips opted-out members", async () => {
    const m1 = member("m1", { notificationsOptedOut: true });
    const ct1 = classType("ct1");
    const sess1 = session("s1", IN_12_HOURS);
    const book1 = booking("b1", "s1", "m1");

    repos = createInMemoryRepositories(
      baseSeed({
        members: [m1],
        classTypes: [ct1],
        sessions: [sess1],
        bookings: [book1],
      }),
    );

    const result = await runReminders(repos, NOW);
    expect(result.sessionsProcessed).toBe(1);
    expect(result.notificationsQueued).toBe(0);

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(0);
  });

  it("skips sessions outside the 24-hour window", async () => {
    const m1 = member("m1");
    const ct1 = classType("ct1");
    const sess1 = session("s1", IN_25_HOURS);
    const book1 = booking("b1", "s1", "m1");

    repos = createInMemoryRepositories(
      baseSeed({
        members: [m1],
        classTypes: [ct1],
        sessions: [sess1],
        bookings: [book1],
      }),
    );

    const result = await runReminders(repos, NOW);
    expect(result.sessionsProcessed).toBe(0);
    expect(result.notificationsQueued).toBe(0);

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(0);
  });

  it("is idempotent: second run does not queue duplicates", async () => {
    const m1 = member("m1");
    const ct1 = classType("ct1");
    const sess1 = session("s1", IN_12_HOURS);
    const book1 = booking("b1", "s1", "m1");

    repos = createInMemoryRepositories(
      baseSeed({
        members: [m1],
        classTypes: [ct1],
        sessions: [sess1],
        bookings: [book1],
      }),
    );

    const result1 = await runReminders(repos, NOW);
    expect(result1.notificationsQueued).toBe(1);

    const result2 = await runReminders(repos, NOW);
    expect(result2.notificationsQueued).toBe(0);

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(1);
  });

  it("respects studio notify_reminders setting", async () => {
    const m1 = member("m1");
    const ct1 = classType("ct1");
    const sess1 = session("s1", IN_12_HOURS);
    const book1 = booking("b1", "s1", "m1");

    repos = createInMemoryRepositories(
      baseSeed({
        members: [m1],
        classTypes: [ct1],
        sessions: [sess1],
        bookings: [book1],
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
          notifyReminders: false,
        },
      }),
    );

    const result = await runReminders(repos, NOW);
    expect(result.notificationsQueued).toBe(0);

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(0);
  });
});
