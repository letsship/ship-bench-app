import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as runRemindersPost } from "@/app/api/reminders/run/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession, Member } from "@/lib/db/types";
import { runReminders } from "./reminders";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(async () => ({ email: "operator@example.com" })),
}));

const NOW = new Date("2026-08-01T12:00:00.000Z");
const NOW_ISO = NOW.toISOString();
const IN_WINDOW = new Date(NOW.getTime() + 12 * 60 * 60 * 1000).toISOString();
const AT_BOUNDARY = new Date(NOW.getTime() + 24 * 60 * 60 * 1000).toISOString();
const OUTSIDE_WINDOW = new Date(NOW.getTime() + 24 * 60 * 60 * 1000 + 1).toISOString();

function session(seed: SeedData, startsAt = IN_WINDOW): ClassSession {
  return {
    ...seed.sessions[0],
    id: "session_reminder",
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString(),
  };
}

function member(seed: SeedData, overrides: Partial<Member> = {}): Member {
  return {
    ...seed.members[0],
    id: "member_reminder",
    notificationsOptedOut: false,
    ...overrides,
  };
}

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "booking_reminder",
    sessionId: "session_reminder",
    memberId: "member_reminder",
    status: "booked",
    bookedAt: NOW_ISO,
    cancelledAt: null,
    ...overrides,
  };
}

function reminderSeed(options: {
  startsAt?: string;
  bookingStatus?: string;
  notificationsOptedOut?: boolean;
} = {}): SeedData {
  const seed = buildSeed(NOW);
  return {
    ...seed,
    members: [member(seed, { notificationsOptedOut: options.notificationsOptedOut ?? false })],
    sessions: [session(seed, options.startsAt)],
    bookings: [booking({ status: options.bookingStatus ?? "booked" })],
    outbox: [],
  };
}

async function reminderRows(repos: Repositories) {
  return repos.outbox.listByKind("booking_reminder");
}

describe("runReminders", () => {
  it("queues a pending reminder for a confirmed booking within 24 hours", async () => {
    const repos = createInMemoryRepositories(reminderSeed({ startsAt: AT_BOUNDARY }));

    const summary = await runReminders(repos, { now: () => NOW_ISO });
    const [row] = await reminderRows(repos);
    const payload = JSON.parse(row.payload) as { data: Record<string, unknown> };

    expect(summary).toEqual({ queued: 1, skippedOptedOut: 0, skippedDuplicate: 0 });
    expect(row).toMatchObject({ kind: "booking_reminder", sentAt: null });
    expect(payload.data).toMatchObject({
      bookingId: "booking_reminder",
      sessionId: "session_reminder",
      startsAt: AT_BOUNDARY,
    });
  });

  it("does not queue reminders for waitlisted bookings", async () => {
    const repos = createInMemoryRepositories(reminderSeed({ bookingStatus: "waitlisted" }));

    expect(await runReminders(repos, { now: () => NOW_ISO })).toMatchObject({ queued: 0 });
    expect(await reminderRows(repos)).toEqual([]);
  });

  it("does not queue reminders for opted-out members", async () => {
    const repos = createInMemoryRepositories(reminderSeed({ notificationsOptedOut: true }));

    expect(await runReminders(repos, { now: () => NOW_ISO })).toEqual({
      queued: 0,
      skippedOptedOut: 1,
      skippedDuplicate: 0,
    });
    expect(await reminderRows(repos)).toEqual([]);
  });

  it("does not queue reminders outside the 24-hour window", async () => {
    const repos = createInMemoryRepositories(reminderSeed({ startsAt: OUTSIDE_WINDOW }));

    expect(await runReminders(repos, { now: () => NOW_ISO })).toMatchObject({ queued: 0 });
    expect(await reminderRows(repos)).toEqual([]);
  });

  it("does not queue a duplicate reminder on a second run", async () => {
    const repos = createInMemoryRepositories(reminderSeed());

    await runReminders(repos, { now: () => NOW_ISO });
    const second = await runReminders(repos, { now: () => NOW_ISO });

    expect(second).toEqual({ queued: 0, skippedOptedOut: 0, skippedDuplicate: 1 });
    expect(await reminderRows(repos)).toHaveLength(1);
  });
});

describe("POST /api/reminders/run", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns HTTP 200", async () => {
    const response = await runRemindersPost();

    expect(response.status).toBe(200);
  });
});
