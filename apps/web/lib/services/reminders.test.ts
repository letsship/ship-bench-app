import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories, type SeedData } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type {
  Booking,
  ClassSession,
  ClassType,
  Member,
  Studio,
  StudioSettings,
} from "@/lib/db/types";
import { runReminders } from "./reminders";
import type { StudioContext } from "./studio";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const IN_WINDOW = "2026-03-16T08:00:00.000Z";
const OUT_OF_WINDOW = "2026-03-18T08:00:00.000Z";

const studio: Studio = {
  id: "studio-1",
  name: "Test Studio",
  slug: "test",
  timezone: "Europe/Amsterdam",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const settings: StudioSettings = {
  studioId: studio.id,
  currency: "EUR",
  taxRateBps: 900,
  cancellationWindowHours: 12,
  waitlistEnabled: true,
  notifyBookingConfirmations: true,
  notifyCancellations: true,
  notifyWaitlistPromotions: true,
  notifyInvoices: true,
  notifyReminders: true,
};

const classType: ClassType = {
  id: "ct-1",
  studioId: studio.id,
  name: "Sunrise Yoga",
  description: null,
  color: "#000000",
  defaultCapacity: 10,
  defaultPriceCents: 1500,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function member(id: string, optedOut = false): Member {
  return {
    id,
    studioId: studio.id,
    name: `Member ${id}`,
    email: `${id}@example.com`,
    phone: null,
    status: "active",
    notificationsOptedOut: optedOut,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function session(id: string, startsAt: string): ClassSession {
  return {
    id,
    studioId: studio.id,
    classTypeId: classType.id,
    instructor: "Noor",
    startsAt,
    endsAt: startsAt,
    capacity: 10,
    priceCents: 1500,
    status: "scheduled",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function booking(id: string, sessionId: string, memberId: string, status: string): Booking {
  return {
    id,
    sessionId,
    memberId,
    status,
    bookedAt: "2026-03-01T00:00:00.000Z",
    cancelledAt: null,
  };
}

function seed(): SeedData {
  return {
    studio,
    settings,
    members: [member("m-1"), member("m-2"), member("m-opted-out", true)],
    classTypes: [classType],
    sessions: [session("s-in", IN_WINDOW), session("s-out", OUT_OF_WINDOW)],
    bookings: [
      booking("b-1", "s-in", "m-1", "booked"),
      booking("b-2", "s-in", "m-2", "waitlisted"),
      booking("b-3", "s-in", "m-opted-out", "booked"),
      booking("b-4", "s-out", "m-1", "booked"),
    ],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

describe("runReminders", () => {
  let repos: Repositories;
  const ctx: StudioContext = { studio, settings };

  beforeEach(() => {
    repos = createInMemoryRepositories(seed());
  });

  it("queues one pending reminder per confirmed booking in the 24h window", async () => {
    const summary = await runReminders(repos, ctx, { now: NOW });
    expect(summary).toEqual({ queued: 1 });
    const rows = await repos.outbox.listByKind("booking_reminder");
    expect(rows).toHaveLength(1);
    expect(rows[0].memberId).toBe("m-1");
    expect(rows[0].sentAt).toBeNull();
    expect(rows[0].dedupKey).toBe("booking_reminder:b-1");
  });

  it("excludes waitlisted members, opted-out members, and out-of-window sessions", async () => {
    await runReminders(repos, ctx, { now: NOW });
    const memberIds = (await repos.outbox.listPending()).map((row) => row.memberId);
    expect(memberIds).not.toContain("m-2");
    expect(memberIds).not.toContain("m-opted-out");
    expect(memberIds).toHaveLength(1);
  });

  it("is idempotent: a second run queues no duplicates", async () => {
    await runReminders(repos, ctx, { now: NOW });
    const second = await runReminders(repos, ctx, { now: NOW });
    expect(second).toEqual({ queued: 0 });
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(1);
  });

  it("queues nothing when the studio has reminders disabled", async () => {
    const off: StudioContext = { studio, settings: { ...settings, notifyReminders: false } };
    const summary = await runReminders(repos, off, { now: NOW });
    expect(summary).toEqual({ queued: 0 });
    expect(await repos.outbox.listPending()).toHaveLength(0);
  });
});
