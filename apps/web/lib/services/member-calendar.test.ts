import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { getMemberCalendarEvents } from "./member-calendar";

// The service filters against the real clock (`new Date()`), so fixtures anchor
// sessions genuinely in the future/past of the real now — same approach the
// booking/cancellation service tests use.
const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();
const PAST = new Date(NOW.getTime() - 7 * 86_400_000).toISOString();
const PAST_END = new Date(NOW.getTime() - 7 * 86_400_000 + 3_600_000).toISOString();

function baseSeed(): SeedData {
  const studioId = "s1";
  const m1: Member = {
    id: "m1",
    studioId,
    name: "Member One",
    email: "m1@e.co",
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    calendarToken: "tok-m1",
    createdAt: ISO,
  };
  const m2: Member = {
    id: "m2",
    studioId,
    name: "Member Two",
    email: "m2@e.co",
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    calendarToken: "tok-m2",
    createdAt: ISO,
  };
  const yoga: ClassType = {
    id: "ct1",
    studioId,
    name: "Vinyasa Flow",
    description: null,
    color: "#5b8c5a",
    defaultCapacity: 16,
    defaultPriceCents: 1800,
    createdAt: ISO,
  };
  const past: ClassSession = session("s-past", studioId, "ct1", "Noor", PAST, PAST_END);
  const futM1: ClassSession = session("s-fut-m1", studioId, "ct1", "Sanne", FUTURE, FUTURE_END);
  const futM2: ClassSession = session("s-fut-m2", studioId, "ct1", "Tomás", FUTURE, FUTURE_END);
  const waitlist: ClassSession = session("s-wait", studioId, "ct1", "Priya", FUTURE, FUTURE_END);
  const cancelled: ClassSession = session("s-cancel", studioId, "ct1", "Wouter", FUTURE, FUTURE_END);

  const bookings: Booking[] = [
    booking("b1", past.id, m1.id, "attended"), // past seat-taking — excluded by time
    booking("b2", futM1.id, m1.id, "booked"), // m1 upcoming — included
    booking("b3", futM2.id, m2.id, "booked"), // other member — excluded
    booking("b4", waitlist.id, m1.id, "waitlisted"), // not seat-taking — excluded
    booking("b5", cancelled.id, m1.id, "cancelled"), // not seat-taking — excluded
  ];

  return {
    studio: { id: studioId, name: "Studio", slug: "studio", timezone: "UTC", createdAt: ISO },
    settings: {
      studioId,
      currency: "EUR",
      taxRateBps: 900,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
    members: [m1, m2],
    classTypes: [yoga],
    sessions: [past, futM1, futM2, waitlist, cancelled],
    bookings,
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

function session(
  id: string,
  studioId: string,
  classTypeId: string,
  instructor: string,
  startsAt: string,
  endsAt: string,
): ClassSession {
  return {
    id,
    studioId,
    classTypeId,
    instructor,
    startsAt,
    endsAt,
    capacity: 16,
    priceCents: 1800,
    status: "scheduled",
    createdAt: ISO,
  };
}

function booking(id: string, sessionId: string, memberId: string, status: string): Booking {
  return { id, sessionId, memberId, status, bookedAt: ISO, cancelledAt: null };
}

describe("getMemberCalendarEvents", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(baseSeed());
  });

  it("returns only the token-holder's upcoming seat-taking sessions", async () => {
    const feed = await getMemberCalendarEvents(repos, "tok-m1");
    expect(feed).not.toBeNull();
    expect(feed?.member.id).toBe("m1");
    expect(feed?.events.map((e) => e.uid)).toEqual(["s-fut-m1@studiobook"]);
    expect(feed?.events[0].title).toBe("Vinyasa Flow");
    expect(feed?.events[0].description).toBe("Instructor: Sanne");
  });

  it("excludes other members' sessions", async () => {
    const feed = await getMemberCalendarEvents(repos, "tok-m2");
    expect(feed?.events.map((e) => e.uid)).toEqual(["s-fut-m2@studiobook"]);
  });

  it("excludes past sessions", async () => {
    const feed = await getMemberCalendarEvents(repos, "tok-m1");
    expect(feed?.events.some((e) => e.uid === "s-past@studiobook")).toBe(false);
  });

  it("excludes waitlisted and cancelled bookings", async () => {
    const feed = await getMemberCalendarEvents(repos, "tok-m1");
    const uids = feed?.events.map((e) => e.uid) ?? [];
    expect(uids).not.toContain("s-wait@studiobook");
    expect(uids).not.toContain("s-cancel@studiobook");
  });

  it("returns null for an unknown token", async () => {
    expect(await getMemberCalendarEvents(repos, "not-a-real-token")).toBeNull();
  });

  it("returns null for an empty token", async () => {
    expect(await getMemberCalendarEvents(repos, "")).toBeNull();
  });

  it("returns upcoming events for the seeded dataset", async () => {
    // buildSeed around the real now guarantees some future booked sessions.
    const seeded = createInMemoryRepositories(buildSeed(NOW));
    const studio = await seeded.studios.getFirst();
    const members = await seeded.members.listByStudio(studio!.id);
    const feed = await getMemberCalendarEvents(seeded, members[0].calendarToken);
    // sanity: a valid seeded token resolves a feed (not null), member matches.
    expect(feed).not.toBeNull();
    expect(feed?.member.id).toBe(members[0].id);
  });
});
