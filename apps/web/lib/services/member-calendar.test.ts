import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { SeedData } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { getMemberCalendarByToken } from "./member-calendar";

// A fixed clock so past/future filtering is deterministic regardless of when
// the suite runs. NOW is "now"; sessions before it are past, sessions at/after
// it are upcoming.
const NOW = new Date("2026-03-15T12:00:00.000Z");
const PAST = "2026-03-10T09:00:00.000Z";
const PAST_END = "2026-03-10T10:00:00.000Z";
const FUTURE = "2026-03-20T09:00:00.000Z";
const FUTURE_END = "2026-03-20T10:00:00.000Z";

const studioName = "Riverbank Movement";

const member = (id: string, token: string): Member => ({
  id,
  studioId: "s1",
  name: id,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  icalToken: token,
  createdAt: NOW.toISOString(),
});

const classType = (id: string): ClassType => ({
  id,
  studioId: "s1",
  name: `Yoga ${id}`,
  description: null,
  color: "#111111",
  defaultCapacity: 10,
  defaultPriceCents: 1000,
  createdAt: NOW.toISOString(),
});

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "Noor",
  startsAt: FUTURE,
  endsAt: FUTURE_END,
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: NOW.toISOString(),
  ...over,
});

const booking = (id: string, memberId: string, over: Partial<Booking> = {}): Booking => ({
  id,
  sessionId: "cs-future",
  memberId,
  status: "booked",
  bookedAt: NOW.toISOString(),
  cancelledAt: null,
  ...over,
});

function seed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: "s1", name: studioName, slug: "s", timezone: "Europe/Amsterdam", createdAt: NOW.toISOString() },
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
    members: [member("m1", "token-m1"), member("m2", "token-m2")],
    classTypes: [classType("ct1")],
    sessions: [
      session("cs-future"),
      session("cs-past", { startsAt: PAST, endsAt: PAST_END }),
    ],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

describe("getMemberCalendarByToken", () => {
  it("returns only the token-holder's upcoming seat-taking sessions", async () => {
    const repos = createInMemoryRepositories(
      seed({
        bookings: [
          booking("b-future", "m1"), // upcoming, booked -> included
          booking("b-past", "m1", { sessionId: "cs-past" }), // past -> excluded
          booking("b-other", "m2"), // another member -> excluded
        ],
      }),
    );
    const result = await getMemberCalendarByToken(repos, studioName, "token-m1", NOW);
    expect(result).not.toBeNull();
    expect(result?.member.id).toBe("m1");
    expect(result?.events).toHaveLength(1);
    expect(result?.events[0].uid).toBe("cs-future@studiobook");
    expect(result?.events[0].title).toBe("Yoga ct1");
    expect(result?.events[0].location).toBe(studioName);
  });

  it("excludes waitlisted and cancelled bookings", async () => {
    const repos = createInMemoryRepositories(
      seed({
        bookings: [
          booking("b-wait", "m1", { status: "waitlisted" }),
          booking("b-cancel", "m1", { status: "cancelled", cancelledAt: NOW.toISOString() }),
          booking("b-ok", "m1"),
        ],
      }),
    );
    const result = await getMemberCalendarByToken(repos, studioName, "token-m1", NOW);
    expect(result?.events).toHaveLength(1);
    expect(result?.events[0].uid).toBe("cs-future@studiobook");
  });

  it("includes attended / no_show as seat-taking for upcoming sessions", async () => {
    const repos = createInMemoryRepositories(
      seed({
        bookings: [
          booking("b-attended", "m1", { status: "attended" }),
          booking("b-noshow", "m1", { status: "no_show" }),
        ],
      }),
    );
    const result = await getMemberCalendarByToken(repos, studioName, "token-m1", NOW);
    expect(result?.events).toHaveLength(1);
  });

  it("returns null for an unknown token", async () => {
    const repos = createInMemoryRepositories(seed());
    expect(await getMemberCalendarByToken(repos, studioName, "no-such-token", NOW)).toBeNull();
  });

  it("returns null for an empty token", async () => {
    const repos = createInMemoryRepositories(seed());
    expect(await getMemberCalendarByToken(repos, studioName, "", NOW)).toBeNull();
  });

  it("returns an empty event list when the member has no seat-taking bookings", async () => {
    const repos = createInMemoryRepositories(
      seed({ bookings: [booking("b-wait", "m1", { status: "waitlisted" })] }),
    );
    const result = await getMemberCalendarByToken(repos, studioName, "token-m1", NOW);
    expect(result).not.toBeNull();
    expect(result?.events).toEqual([]);
  });

  it("works against the full seeded dataset", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const studio = await repos.studios.getFirst();
    const members = await repos.members.listByStudio(studio!.id);
    const first = members[0];
    expect(first.icalToken).toBeTruthy();
    const result = await getMemberCalendarByToken(repos, studioName, first.icalToken, NOW);
    expect(result).not.toBeNull();
    expect(result?.member.id).toBe(first.id);
    // Every emitted event must start at/after NOW (no past sessions leak).
    for (const event of result?.events ?? []) {
      expect(event.startsAt >= NOW.toISOString()).toBe(true);
    }
  });
});
