import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { runReminders } from "./reminders";

// Fixed clock so the 24h window is deterministic. Sessions are placed at known
// offsets from NOW; the service receives `now: () => NOW_ISO` so it sees them.
const NOW = new Date("2026-03-15T12:00:00.000Z");
const NOW_ISO = NOW.toISOString();
const HOUR = 3_600_000;
const soonStart = new Date(NOW.getTime() + 2 * HOUR).toISOString();
const soonEnd = new Date(NOW.getTime() + 3 * HOUR).toISOString();
const lateStart = new Date(NOW.getTime() + 25 * HOUR).toISOString();
const lateEnd = new Date(NOW.getTime() + 26 * HOUR).toISOString();
const pastStart = new Date(NOW.getTime() - 2 * HOUR).toISOString();
const pastEnd = new Date(NOW.getTime() - 1 * HOUR).toISOString();

function baseSeed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: NOW_ISO },
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
  createdAt: NOW_ISO,
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
  createdAt: NOW_ISO,
});

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "I",
  startsAt: soonStart,
  endsAt: soonEnd,
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: NOW_ISO,
  ...over,
});

const booking = (id: string, memberId: string, over: Partial<Booking> = {}): Booking => ({
  id,
  sessionId: "cs_soon",
  memberId,
  status: "booked",
  bookedAt: NOW_ISO,
  cancelledAt: null,
  ...over,
});

// m1 opted-in, m2 opted-out, m3 opted-in. cs_soon is in the 24h window; cs_late
// and cs_past are outside it.
function reminderSeed(): SeedData {
  return baseSeed({
    classTypes: [classType("ct1")],
    members: [member("m1"), member("m2", { notificationsOptedOut: true }), member("m3")],
    sessions: [
      session("cs_soon"),
      session("cs_late", { startsAt: lateStart, endsAt: lateEnd }),
      session("cs_past", { startsAt: pastStart, endsAt: pastEnd }),
    ],
    bookings: [
      booking("b1", "m1", { sessionId: "cs_soon", status: "booked" }),
      booking("b2", "m3", { sessionId: "cs_soon", status: "waitlisted" }),
      booking("b3", "m2", { sessionId: "cs_soon", status: "booked" }),
      booking("b4", "m1", { sessionId: "cs_late", status: "booked" }),
      booking("b5", "m1", { sessionId: "cs_past", status: "booked" }),
    ],
  });
}

const remindersFor = (repos: Repositories) =>
  repos.outbox.listByKind("booking_reminder");

describe("runReminders", () => {
  it("queues one pending reminder per confirmed in-window seat", async () => {
    const repos = createInMemoryRepositories(reminderSeed());
    const summary = await runReminders(repos, { now: () => NOW_ISO });

    expect(summary).toEqual({ queued: 1, skippedOptedOut: 1, alreadyQueued: 0 });

    const rows = await remindersFor(repos);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("booking_reminder");
    expect(rows[0].memberId).toBe("m1");
    expect(rows[0].sentAt).toBeNull();
    const data = JSON.parse(rows[0].payload).data as { bookingId: string; sessionId: string };
    expect(data.bookingId).toBe("b1");
    expect(data.sessionId).toBe("cs_soon");
  });

  it("skips waitlisted seats and sessions outside the 24h window", async () => {
    const repos = createInMemoryRepositories(reminderSeed());
    await runReminders(repos, { now: () => NOW_ISO });

    const rows = await remindersFor(repos);
    expect(rows).toHaveLength(1);
    expect(rows[0].memberId).toBe("m1");
    // The waitlisted seat (b2), the late session (b4) and the past session
    // (b5) produce no reminder rows.
  });

  it("skips members who have opted out of notifications", async () => {
    const repos = createInMemoryRepositories(reminderSeed());
    const summary = await runReminders(repos, { now: () => NOW_ISO });

    expect(summary.skippedOptedOut).toBe(1);
    const rows = await remindersFor(repos);
    expect(rows.some((row) => row.memberId === "m2")).toBe(false);
  });

  it("is idempotent across repeated runs, even after the row is marked sent", async () => {
    const repos = createInMemoryRepositories(reminderSeed());

    const first = await runReminders(repos, { now: () => NOW_ISO });
    expect(first.queued).toBe(1);
    const afterFirst = await remindersFor(repos);
    expect(afterFirst).toHaveLength(1);

    // Second run finds the existing reminder and queues no duplicate.
    const second = await runReminders(repos, { now: () => NOW_ISO });
    expect(second).toEqual({ queued: 0, skippedOptedOut: 1, alreadyQueued: 1 });
    expect(await remindersFor(repos)).toHaveLength(1);

    // Dispatch marks the row sent; idempotency must still hold (listByKind
    // returns sent rows too), so a later cron run does not re-queue.
    await repos.outbox.update(afterFirst[0].id, { sentAt: NOW_ISO });
    const third = await runReminders(repos, { now: () => NOW_ISO });
    expect(third).toEqual({ queued: 0, skippedOptedOut: 1, alreadyQueued: 1 });
    expect(await remindersFor(repos)).toHaveLength(1);
  });
});

describe("runReminders against the full seed", () => {
  it("reminds in-window members but never the opted-out member, and is idempotent", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const studio = await repos.studios.getFirst();
    if (!studio) throw new Error("seed studio missing");
    const gonzalo = (await repos.members.listByStudio(studio.id)).find(
      (m) => m.email === "gonzalo@example.com",
    );
    expect(gonzalo).toBeTruthy();

    const first = await runReminders(repos, { now: () => NOW_ISO });
    expect(first.queued).toBeGreaterThan(0);

    const rows = await remindersFor(repos);
    expect(rows.every((row) => row.memberId !== gonzalo!.id)).toBe(true);

    const beforeSecond = rows.length;
    const second = await runReminders(repos, { now: () => NOW_ISO });
    expect(second.queued).toBe(0);
    expect(await remindersFor(repos)).toHaveLength(beforeSecond);
  });
});
