import { beforeEach, describe, expect, it } from "vitest";
import { newId } from "@/lib/db/ids";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type {
  Booking,
  ClassSession,
  Member,
  ClassType,
  Studio,
  StudioSettings,
} from "@/lib/db/types";
import { runReminders } from "./reminders";

const NOW = new Date("2026-07-19T12:00:00.000Z");
const NOW_ISO = NOW.toISOString();
const IN_23H = new Date(NOW.getTime() + 23 * 60 * 60 * 1000).toISOString();
const IN_25H = new Date(NOW.getTime() + 25 * 60 * 60 * 1000).toISOString();

function minimalSeed(): SeedData {
  const studio: Studio = {
    id: "s1",
    name: "Test Studio",
    slug: "test",
    timezone: "UTC",
    createdAt: NOW_ISO,
  };
  const settings: StudioSettings = {
    studioId: "s1",
    currency: "USD",
    taxRateBps: 0,
    cancellationWindowHours: 24,
    waitlistEnabled: true,
    notifyBookingConfirmations: true,
    notifyCancellations: true,
    notifyWaitlistPromotions: true,
    notifyInvoices: true,
  };
  const member: Member = {
    id: "m1",
    studioId: "s1",
    name: "Test Member",
    email: "test@example.com",
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: NOW_ISO,
  };
  const classType: ClassType = {
    id: "ct1",
    studioId: "s1",
    name: "Yoga",
    description: null,
    color: "#111111",
    defaultCapacity: 10,
    defaultPriceCents: 1500,
    createdAt: NOW_ISO,
  };
  return {
    studio,
    settings,
    members: [member],
    classTypes: [classType],
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

describe("runReminders", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(minimalSeed());
  });

  it("queues a reminder for a booked member in a session within 24 hours", async () => {
    const studio = await repos.studios.getFirst();
    const members = await repos.members.listByStudio(studio!.id);
    const classTypes = await repos.classTypes.listByStudio(studio!.id);

    const session: ClassSession = {
      id: newId(),
      studioId: studio!.id,
      classTypeId: classTypes[0].id,
      instructor: "Alice",
      startsAt: IN_23H,
      endsAt: new Date(new Date(IN_23H).getTime() + 60 * 60 * 1000).toISOString(),
      capacity: 10,
      priceCents: 1500,
      status: "active",
      createdAt: NOW_ISO,
    };
    const booking: Booking = {
      id: newId(),
      sessionId: session.id,
      memberId: members[0].id,
      status: "booked",
      bookedAt: NOW_ISO,
      cancelledAt: null,
    };

    await repos.classSessions.insert(session);
    await repos.bookings.insert(booking);

    const result = await runReminders(repos, { now: () => NOW_ISO });

    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(0);
    const pending = await repos.outbox.listPending();
    expect(pending.some((r) => r.kind === "booking_reminder")).toBe(true);
  });

  it("does not queue a reminder for waitlisted members", async () => {
    const studio = await repos.studios.getFirst();
    const members = await repos.members.listByStudio(studio!.id);
    const classTypes = await repos.classTypes.listByStudio(studio!.id);

    const session: ClassSession = {
      id: newId(),
      studioId: studio!.id,
      classTypeId: classTypes[0].id,
      instructor: "Alice",
      startsAt: IN_23H,
      endsAt: new Date(new Date(IN_23H).getTime() + 60 * 60 * 1000).toISOString(),
      capacity: 10,
      priceCents: 1500,
      status: "active",
      createdAt: NOW_ISO,
    };
    const booking: Booking = {
      id: newId(),
      sessionId: session.id,
      memberId: members[0].id,
      status: "waitlisted",
      bookedAt: NOW_ISO,
      cancelledAt: null,
    };

    await repos.classSessions.insert(session);
    await repos.bookings.insert(booking);

    await runReminders(repos, { now: () => NOW_ISO });

    const pending = await repos.outbox.listPending();
    expect(pending.filter((r) => r.kind === "booking_reminder")).toHaveLength(0);
  });

  it("does not queue a reminder for opted-out members", async () => {
    const studio = await repos.studios.getFirst();
    const members = await repos.members.listByStudio(studio!.id);
    const classTypes = await repos.classTypes.listByStudio(studio!.id);

    await repos.members.update(members[0].id, { notificationsOptedOut: true });

    const session: ClassSession = {
      id: newId(),
      studioId: studio!.id,
      classTypeId: classTypes[0].id,
      instructor: "Alice",
      startsAt: IN_23H,
      endsAt: new Date(new Date(IN_23H).getTime() + 60 * 60 * 1000).toISOString(),
      capacity: 10,
      priceCents: 1500,
      status: "active",
      createdAt: NOW_ISO,
    };
    const booking: Booking = {
      id: newId(),
      sessionId: session.id,
      memberId: members[0].id,
      status: "booked",
      bookedAt: NOW_ISO,
      cancelledAt: null,
    };

    await repos.classSessions.insert(session);
    await repos.bookings.insert(booking);

    await runReminders(repos, { now: () => NOW_ISO });

    const pending = await repos.outbox.listPending();
    expect(pending.filter((r) => r.kind === "booking_reminder")).toHaveLength(0);
  });

  it("does not queue a reminder for sessions outside 24-hour window", async () => {
    const studio = await repos.studios.getFirst();
    const members = await repos.members.listByStudio(studio!.id);
    const classTypes = await repos.classTypes.listByStudio(studio!.id);

    const session: ClassSession = {
      id: newId(),
      studioId: studio!.id,
      classTypeId: classTypes[0].id,
      instructor: "Alice",
      startsAt: IN_25H,
      endsAt: new Date(new Date(IN_25H).getTime() + 60 * 60 * 1000).toISOString(),
      capacity: 10,
      priceCents: 1500,
      status: "active",
      createdAt: NOW_ISO,
    };
    const booking: Booking = {
      id: newId(),
      sessionId: session.id,
      memberId: members[0].id,
      status: "booked",
      bookedAt: NOW_ISO,
      cancelledAt: null,
    };

    await repos.classSessions.insert(session);
    await repos.bookings.insert(booking);

    const result = await runReminders(repos, { now: () => NOW_ISO });

    expect(result.queued).toBe(0);
  });

  it("is idempotent: running twice does not duplicate reminders", async () => {
    const studio = await repos.studios.getFirst();
    const members = await repos.members.listByStudio(studio!.id);
    const classTypes = await repos.classTypes.listByStudio(studio!.id);

    const session: ClassSession = {
      id: newId(),
      studioId: studio!.id,
      classTypeId: classTypes[0].id,
      instructor: "Alice",
      startsAt: IN_23H,
      endsAt: new Date(new Date(IN_23H).getTime() + 60 * 60 * 1000).toISOString(),
      capacity: 10,
      priceCents: 1500,
      status: "active",
      createdAt: NOW_ISO,
    };
    const booking: Booking = {
      id: newId(),
      sessionId: session.id,
      memberId: members[0].id,
      status: "booked",
      bookedAt: NOW_ISO,
      cancelledAt: null,
    };

    await repos.classSessions.insert(session);
    await repos.bookings.insert(booking);

    const result1 = await runReminders(repos, { now: () => NOW_ISO });
    expect(result1.queued).toBe(1);

    const result2 = await runReminders(repos, { now: () => NOW_ISO });
    expect(result2.queued).toBe(0);

    const allReminders = await repos.outbox.listByKind("booking_reminder");
    expect(allReminders).toHaveLength(1);
  });
});
