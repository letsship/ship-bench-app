import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as remindersRun } from "@/app/api/reminders/run/route";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession, Member, NotificationOutboxRow } from "@/lib/db/types";
import { runClassReminders } from "./reminders";

// The route handler reaches for the session cookie through next/headers, which
// has no request context under vitest — back it with a plain map we control.
const { cookieJar } = vi.hoisted(() => ({ cookieJar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");
const NOW_ISO = NOW.toISOString();
const HOUR_MS = 3_600_000;
const iso = (offsetMs: number): string => new Date(NOW.getTime() + offsetMs).toISOString();

// Inside the 24h window, and safely outside it.
const SOON = iso(6 * HOUR_MS);
const TOMORROW = iso(20 * HOUR_MS);
const NEXT_WEEK = iso(7 * 24 * HOUR_MS);

const session = (id: string, startsAt: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "Noor",
  startsAt,
  endsAt: new Date(new Date(startsAt).getTime() + HOUR_MS).toISOString(),
  capacity: 10,
  priceCents: 1800,
  status: "scheduled",
  createdAt: NOW_ISO,
  ...over,
});

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

const booking = (id: string, sessionId: string, memberId: string, status: string): Booking => ({
  id,
  sessionId,
  memberId,
  status,
  bookedAt: NOW_ISO,
  cancelledAt: null,
});

function seedWith(over: Partial<SeedData> = {}): SeedData {
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
    classTypes: [
      {
        id: "ct1",
        studioId: "s1",
        name: "Vinyasa Flow",
        description: null,
        color: "#5b8c5a",
        defaultCapacity: 10,
        defaultPriceCents: 1800,
        createdAt: NOW_ISO,
      },
    ],
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

const reminders = async (repos: Repositories): Promise<NotificationOutboxRow[]> =>
  repos.outbox.listByKind("booking_reminder");

const remindedMemberIds = async (repos: Repositories): Promise<string[]> =>
  (await reminders(repos)).map((row) => row.memberId).sort();

describe("runClassReminders", () => {
  it("queues one pending reminder per confirmed seat in the next 24 hours", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        members: [member("m1"), member("m2")],
        sessions: [session("sess1", SOON)],
        bookings: [booking("b1", "sess1", "m1", "booked"), booking("b2", "sess1", "m2", "booked")],
      }),
    );

    expect(await runClassReminders(repos, { now: NOW_ISO })).toEqual({ queued: 2 });
    const rows = await reminders(repos);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.sentAt === null)).toBe(true);
    expect(await remindedMemberIds(repos)).toEqual(["m1", "m2"]);

    const payload = JSON.parse(rows[0].payload) as {
      subject: string;
      data: { bookingId: string; title: string };
    };
    expect(payload.subject).toContain("Vinyasa Flow");
    expect(payload.data.bookingId).toBe("b1");
    expect(payload.data.title).toBe("Vinyasa Flow");
  });

  it("covers every session in the window, not just the first", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        members: [member("m1"), member("m2")],
        sessions: [session("sess1", SOON), session("sess2", TOMORROW)],
        bookings: [booking("b1", "sess1", "m1", "booked"), booking("b2", "sess2", "m2", "booked")],
      }),
    );

    expect(await runClassReminders(repos, { now: NOW_ISO })).toEqual({ queued: 2 });
    expect(await remindedMemberIds(repos)).toEqual(["m1", "m2"]);
  });

  it("skips waitlisted members — only confirmed seats get a reminder", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        members: [member("m1"), member("m2")],
        sessions: [session("sess1", SOON)],
        bookings: [
          booking("b1", "sess1", "m1", "booked"),
          booking("b2", "sess1", "m2", "waitlisted"),
        ],
      }),
    );

    expect(await runClassReminders(repos, { now: NOW_ISO })).toEqual({ queued: 1 });
    expect(await remindedMemberIds(repos)).toEqual(["m1"]);
  });

  it("skips a member who has opted out of notifications", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        members: [member("m1", { notificationsOptedOut: true }), member("m2")],
        sessions: [session("sess1", SOON)],
        bookings: [booking("b1", "sess1", "m1", "booked"), booking("b2", "sess1", "m2", "booked")],
      }),
    );

    expect(await runClassReminders(repos, { now: NOW_ISO })).toEqual({ queued: 1 });
    expect(await remindedMemberIds(repos)).toEqual(["m2"]);
  });

  it("skips sessions outside the 24 hour window", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        members: [member("m1"), member("m2")],
        sessions: [session("later", NEXT_WEEK), session("past", iso(-2 * HOUR_MS))],
        bookings: [booking("b1", "later", "m1", "booked"), booking("b2", "past", "m2", "booked")],
      }),
    );

    expect(await runClassReminders(repos, { now: NOW_ISO })).toEqual({ queued: 0 });
    expect(await reminders(repos)).toHaveLength(0);
  });

  it("skips a cancelled session", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        members: [member("m1")],
        sessions: [session("sess1", SOON, { status: "cancelled" })],
        bookings: [booking("b1", "sess1", "m1", "booked")],
      }),
    );

    expect(await runClassReminders(repos, { now: NOW_ISO })).toEqual({ queued: 0 });
  });

  it("is idempotent — a second run queues no duplicate", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        members: [member("m1"), member("m2")],
        sessions: [session("sess1", SOON)],
        bookings: [booking("b1", "sess1", "m1", "booked"), booking("b2", "sess1", "m2", "booked")],
      }),
    );

    expect(await runClassReminders(repos, { now: NOW_ISO })).toEqual({ queued: 2 });
    expect(await runClassReminders(repos, { now: NOW_ISO })).toEqual({ queued: 0 });
    expect(await runClassReminders(repos, { now: NOW_ISO })).toEqual({ queued: 0 });
    expect(await reminders(repos)).toHaveLength(2);
  });

  it("stays idempotent after the reminder has already been dispatched", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        members: [member("m1")],
        sessions: [session("sess1", SOON)],
        bookings: [booking("b1", "sess1", "m1", "booked")],
      }),
    );

    await runClassReminders(repos, { now: NOW_ISO });
    const [row] = await reminders(repos);
    await repos.outbox.update(row.id, { sentAt: NOW_ISO, providerMessageId: "re_1" });

    expect(await runClassReminders(repos, { now: NOW_ISO })).toEqual({ queued: 0 });
    expect(await reminders(repos)).toHaveLength(1);
  });

  it("still reminds a newly booked seat in an already-reminded session", async () => {
    const repos = createInMemoryRepositories(
      seedWith({
        members: [member("m1"), member("m2")],
        sessions: [session("sess1", SOON)],
        bookings: [booking("b1", "sess1", "m1", "booked")],
      }),
    );

    expect(await runClassReminders(repos, { now: NOW_ISO })).toEqual({ queued: 1 });
    await repos.bookings.insert(booking("b2", "sess1", "m2", "booked"));
    expect(await runClassReminders(repos, { now: NOW_ISO })).toEqual({ queued: 1 });
    expect(await remindedMemberIds(repos)).toEqual(["m1", "m2"]);
  });
});

// The route takes no `now`, so it reads the real clock: seed against the real
// clock too. buildSeed lays three sessions on every day from -6 to +8, so the
// next 24 hours always contains at least one with confirmed seats.
describe("POST /api/reminders/run", () => {
  beforeEach(() => {
    cookieJar.clear();
    __setTestRepositories(createInMemoryRepositories(buildSeed(new Date())));
  });
  afterEach(() => {
    cookieJar.clear();
    __setTestRepositories(null);
  });

  it("returns 200 and the queued count for a signed-in operator", async () => {
    cookieJar.set(SESSION_COOKIE, await createSessionToken("operator@example.com"));

    const res = await remindersRun();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { queued: number };
    expect(body.queued).toBeGreaterThan(0);
  });

  it("is idempotent across repeated cron calls", async () => {
    cookieJar.set(SESSION_COOKIE, await createSessionToken("operator@example.com"));

    const first = (await (await remindersRun()).json()) as { queued: number };
    const second = (await (await remindersRun()).json()) as { queued: number };
    expect(first.queued).toBeGreaterThan(0);
    expect(second.queued).toBe(0);
  });

  it("returns 401 without a session cookie", async () => {
    const res = await remindersRun();
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("unauthorized");
  });
});
