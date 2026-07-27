import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, Member, Studio, StudioSettings } from "@/lib/db/types";
import { runBookingReminders } from "./reminders";

const ISO = "2026-07-27T12:00:00.000Z";

function seedWith(
  sessionOverrides: Partial<ClassSession>[] = [],
  bookingOverrides: Partial<Booking>[] = [],
  memberOverrides: Partial<Member> = {},
  settingsOverrides: Partial<StudioSettings> = {},
): SeedData {
  const studio: Studio = {
    id: "s1",
    name: "S",
    slug: "s",
    timezone: "UTC",
    createdAt: ISO,
  };

  const settings: StudioSettings = {
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
    ...settingsOverrides,
  };

  const member: Member = {
    id: "m1",
    studioId: "s1",
    name: "M1",
    email: "m1@e.co",
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: ISO,
    ...memberOverrides,
  };

  const classType = {
    id: "ct1",
    studioId: "s1",
    name: "Yoga",
    description: "A yoga class",
    color: "#000000",
    defaultCapacity: 20,
    defaultPriceCents: 1800,
    createdAt: ISO,
  };

  const baseSession: ClassSession = {
    id: "sess1",
    studioId: "s1",
    classTypeId: "ct1",
    instructor: "Instructor",
    startsAt: new Date(new Date(ISO).getTime() + 12 * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(new Date(ISO).getTime() + 13 * 60 * 60 * 1000).toISOString(),
    capacity: 20,
    priceCents: 1800,
    status: "scheduled",
    createdAt: ISO,
  };

  const sessions =
    sessionOverrides.length > 0
      ? sessionOverrides.map((o) => ({ ...baseSession, ...o }))
      : [baseSession];

  const baseBooking: Booking = {
    id: "b1",
    sessionId: "sess1",
    memberId: "m1",
    status: "booked",
    bookedAt: ISO,
    cancelledAt: null,
  };

  const bookings =
    bookingOverrides.length > 0
      ? bookingOverrides.map((o) => ({ ...baseBooking, ...o }))
      : [baseBooking];

  return {
    studio,
    settings,
    members: [member],
    classTypes: [classType],
    sessions,
    bookings,
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

describe("runBookingReminders", () => {
  it("queues a pending booking_reminder for a booked member in a session <24h away", async () => {
    const repos = createInMemoryRepositories(seedWith());
    const now = () => ISO;

    const summary = await runBookingReminders(repos, "s1", { now });

    expect(summary.queued).toBe(1);
    expect(summary.skipped).toBe(0);

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe("booking_reminder");
    expect(pending[0].sentAt).toBeNull();
    expect(pending[0].memberId).toBe("m1");
  });

  it("includes bookingId in the payload for idempotency", async () => {
    const repos = createInMemoryRepositories(seedWith());
    const now = () => ISO;

    await runBookingReminders(repos, "s1", { now });

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(1);

    const payload = JSON.parse(pending[0].payload);
    expect(payload.data.bookingId).toBe("b1");
    expect(payload.data.sessionId).toBe("sess1");
  });

  it("is idempotent: a second run queues no duplicate", async () => {
    const repos = createInMemoryRepositories(seedWith());
    const now = () => ISO;

    const summary1 = await runBookingReminders(repos, "s1", { now });
    expect(summary1.queued).toBe(1);

    const summary2 = await runBookingReminders(repos, "s1", { now });
    expect(summary2.queued).toBe(0);
    expect(summary2.skipped).toBe(1);

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(1);
  });

  it("skips waitlisted seats", async () => {
    const repos = createInMemoryRepositories(
      seedWith(
        [],
        [
          {
            id: "b1",
            sessionId: "sess1",
            memberId: "m1",
            status: "waitlisted",
            bookedAt: ISO,
            cancelledAt: null,
          },
        ],
      ),
    );
    const now = () => ISO;

    const summary = await runBookingReminders(repos, "s1", { now });

    expect(summary.queued).toBe(0);
    expect(summary.skipped).toBe(0);

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(0);
  });

  it("skips sessions outside the 24-hour window", async () => {
    const baseNow = new Date(ISO).getTime();
    const tooFarFuture = new Date(baseNow + 25 * 60 * 60 * 1000).toISOString();

    const repos = createInMemoryRepositories(
      seedWith([
        {
          id: "sess1",
          studioId: "s1",
          classTypeId: "ct1",
          instructor: "I",
          startsAt: tooFarFuture,
          endsAt: new Date(baseNow + 26 * 60 * 60 * 1000).toISOString(),
          capacity: 20,
          priceCents: 1800,
          status: "scheduled",
          createdAt: ISO,
        },
      ]),
    );
    const now = () => ISO;

    const summary = await runBookingReminders(repos, "s1", { now });

    expect(summary.queued).toBe(0);
    expect(summary.skipped).toBe(0);

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(0);
  });

  it("skips members who have opted out of notifications", async () => {
    const repos = createInMemoryRepositories(seedWith([], [], { notificationsOptedOut: true }));
    const now = () => ISO;

    const summary = await runBookingReminders(repos, "s1", { now });

    expect(summary.queued).toBe(0);
    expect(summary.skipped).toBe(1);

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(0);
  });

  it("skips when studio has notifyBookingReminders disabled", async () => {
    const repos = createInMemoryRepositories(
      seedWith([], [], {}, { notifyBookingReminders: false }),
    );
    const now = () => ISO;

    const summary = await runBookingReminders(repos, "s1", { now });

    expect(summary.queued).toBe(0);
    expect(summary.skipped).toBe(1);

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(0);
  });

  it("queues multiple reminders for multiple bookings", async () => {
    const repos = createInMemoryRepositories(
      seedWith(
        [
          {
            id: "sess1",
            studioId: "s1",
            classTypeId: "ct1",
            instructor: "I",
            startsAt: new Date(new Date(ISO).getTime() + 12 * 60 * 60 * 1000).toISOString(),
            endsAt: new Date(new Date(ISO).getTime() + 13 * 60 * 60 * 1000).toISOString(),
            capacity: 20,
            priceCents: 1800,
            status: "scheduled",
            createdAt: ISO,
          },
          {
            id: "sess2",
            studioId: "s1",
            classTypeId: "ct1",
            instructor: "I",
            startsAt: new Date(new Date(ISO).getTime() + 18 * 60 * 60 * 1000).toISOString(),
            endsAt: new Date(new Date(ISO).getTime() + 19 * 60 * 60 * 1000).toISOString(),
            capacity: 20,
            priceCents: 1800,
            status: "scheduled",
            createdAt: ISO,
          },
        ],
        [
          {
            id: "b1",
            sessionId: "sess1",
            memberId: "m1",
            status: "booked",
            bookedAt: ISO,
            cancelledAt: null,
          },
          {
            id: "b2",
            sessionId: "sess2",
            memberId: "m1",
            status: "booked",
            bookedAt: ISO,
            cancelledAt: null,
          },
        ],
      ),
    );
    const now = () => ISO;

    const summary = await runBookingReminders(repos, "s1", { now });

    expect(summary.queued).toBe(2);
    expect(summary.skipped).toBe(0);

    const pending = await repos.outbox.listPending();
    expect(pending).toHaveLength(2);
  });

  it("returns empty summary when there are no sessions in the window", async () => {
    const repos = createInMemoryRepositories(seedWith([], []));
    repos.classSessions.listByStudio = async () => [];
    const now = () => ISO;

    const summary = await runBookingReminders(repos, "s1", { now });

    expect(summary.queued).toBe(0);
    expect(summary.skipped).toBe(0);
  });
});
