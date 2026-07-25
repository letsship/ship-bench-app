import { describe, expect, it } from "vitest";
import { runReminders } from "@/lib/services/reminders";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const ISO = NOW.toISOString();
const IN_12_HOURS = new Date(NOW.getTime() + 12 * 60 * 60 * 1000).toISOString();
const IN_12_HOURS_END = new Date(NOW.getTime() + 13 * 60 * 60 * 1000).toISOString();

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

const session = (id: string, startsAt: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "Alice",
  startsAt,
  endsAt: IN_12_HOURS_END,
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

describe("reminders API route integration", () => {
  it("runReminders returns a valid summary", async () => {
    const m1 = member("m1");
    const ct1 = classType("ct1");
    const sess1 = session("s1", IN_12_HOURS);
    const book1 = booking("b1", "s1", "m1");

    const repos = createInMemoryRepositories(
      baseSeed({
        members: [m1],
        classTypes: [ct1],
        sessions: [sess1],
        bookings: [book1],
      }),
    );

    const result = await runReminders(repos, NOW);
    expect(result).toHaveProperty("sessionsProcessed");
    expect(result).toHaveProperty("notificationsQueued");
    expect(result.sessionsProcessed).toBe(1);
    expect(result.notificationsQueued).toBe(1);
  });
});
