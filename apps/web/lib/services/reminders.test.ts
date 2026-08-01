import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { runReminders } from "./reminders";

const NOW = "2026-08-01T12:00:00.000Z";
const HOUR = 60 * 60 * 1000;
const at = (hoursFromNow: number): string =>
  new Date(new Date(NOW).getTime() + hoursFromNow * HOUR).toISOString();

const member = (id: string, notificationsOptedOut = false): Member => ({
  id,
  studioId: "s1",
  name: id,
  email: `${id}@example.com`,
  phone: null,
  status: "active",
  notificationsOptedOut,
  createdAt: NOW,
});

const session = (id: string, startsAt: string, status = "scheduled"): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "Noor",
  startsAt,
  endsAt: new Date(new Date(startsAt).getTime() + HOUR).toISOString(),
  capacity: 10,
  priceCents: 1800,
  status,
  createdAt: NOW,
});

const booking = (id: string, memberId: string, sessionId: string, status = "booked"): Booking => ({
  id,
  memberId,
  sessionId,
  status,
  bookedAt: NOW,
  cancelledAt: null,
});

function seed(): SeedData {
  const classTypes: ClassType[] = [
    {
      id: "ct1",
      studioId: "s1",
      name: "Morning Yoga",
      description: null,
      color: "#111111",
      defaultCapacity: 10,
      defaultPriceCents: 1800,
      createdAt: NOW,
    },
  ];
  return {
    studio: { id: "s1", name: "Studio", slug: "studio", timezone: "UTC", createdAt: NOW },
    settings: {
      studioId: "s1",
      currency: "EUR",
      taxRateBps: 0,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyBookingReminders: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
    members: [
      member("m-booked"),
      member("m-waitlisted"),
      member("m-opted-out", true),
      member("m-outside"),
      member("m-cancelled"),
    ],
    classTypes,
    sessions: [
      session("inside", at(23)),
      session("outside", at(25)),
      session("cancelled", at(2), "cancelled"),
    ],
    bookings: [
      booking("b-booked", "m-booked", "inside"),
      booking("b-waitlisted", "m-waitlisted", "inside", "waitlisted"),
      booking("b-opted-out", "m-opted-out", "inside"),
      booking("b-outside", "m-outside", "outside"),
      booking("b-cancelled", "m-cancelled", "cancelled"),
    ],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

describe("runReminders", () => {
  it("queues reminders only for confirmed, opted-in bookings within 24 hours", async () => {
    const repos = createInMemoryRepositories(seed());

    await expect(runReminders(repos, { now: () => NOW })).resolves.toEqual({ queued: 1 });

    const [row] = await repos.outbox.listByKind("booking_reminder");
    expect(row).toMatchObject({ kind: "booking_reminder", memberId: "m-booked", sentAt: null });
    expect(JSON.parse(row.payload)).toMatchObject({ data: { bookingId: "b-booked" } });
  });

  it("does not queue a second reminder for the same booking", async () => {
    const repos = createInMemoryRepositories(seed());

    await runReminders(repos, { now: () => NOW });
    await expect(runReminders(repos, { now: () => NOW })).resolves.toEqual({ queued: 0 });
    await expect(repos.outbox.listByKind("booking_reminder")).resolves.toHaveLength(1);
  });
});
