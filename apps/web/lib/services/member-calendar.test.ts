import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, Member } from "@/lib/db/types";
import { buildMemberCalendarFeed } from "./member-calendar";

// The service takes `nowIso` explicitly, so the clock is fully controlled.
const NOW_ISO = "2026-03-15T12:00:00.000Z";
const PAST = "2026-03-10T09:00:00.000Z";
const PAST_END = "2026-03-10T10:00:00.000Z";
const FUTURE = "2026-03-20T09:00:00.000Z";
const FUTURE_END = "2026-03-20T10:00:00.000Z";

const member = (id: string): Member => ({
  id,
  studioId: "s1",
  name: id,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  calendarToken: `caltok-${id}`,
  createdAt: PAST,
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
  createdAt: PAST,
  ...over,
});

const booking = (id: string, sessionId: string, memberId: string, status = "booked"): Booking => ({
  id,
  sessionId,
  memberId,
  status,
  bookedAt: PAST,
  cancelledAt: null,
});

function seed(): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: PAST },
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
    members: [member("m1"), member("m2")],
    classTypes: [
      {
        id: "ct1",
        studioId: "s1",
        name: "Vinyasa Flow",
        description: null,
        color: "#111111",
        defaultCapacity: 10,
        defaultPriceCents: 1000,
        createdAt: PAST,
      },
    ],
    sessions: [
      session("cs-past", { startsAt: PAST, endsAt: PAST_END }),
      session("cs-up1"),
      session("cs-up2"),
      session("cs-wait"),
      session("cs-cxl"),
    ],
    bookings: [
      booking("b1", "cs-past", "m1", "attended"),
      booking("b2", "cs-up1", "m1"),
      booking("b3", "cs-up1", "m2"),
      booking("b4", "cs-up2", "m2"),
      booking("b5", "cs-wait", "m1", "waitlisted"),
      booking("b6", "cs-cxl", "m1", "cancelled"),
    ],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

describe("buildMemberCalendarFeed", () => {
  it("returns only the token-holder's upcoming booked sessions", async () => {
    const repos = createInMemoryRepositories(seed());
    const feed = await buildMemberCalendarFeed(repos, "caltok-m1", NOW_ISO);
    expect(feed).not.toBeNull();
    expect(feed?.member.id).toBe("m1");
    expect(feed?.events.map((event) => event.uid)).toEqual(["cs-up1@studiobook"]);
    expect(feed?.events[0]).toMatchObject({
      title: "Vinyasa Flow",
      startsAt: FUTURE,
      endsAt: FUTURE_END,
      description: "Instructor: Noor",
      location: "S",
    });
  });

  it("excludes past sessions and non-seat-taking (waitlisted/cancelled) bookings", async () => {
    const repos = createInMemoryRepositories(seed());
    const feed = await buildMemberCalendarFeed(repos, "caltok-m1", NOW_ISO);
    const uids = feed?.events.map((event) => event.uid) ?? [];
    expect(uids).not.toContain("cs-past@studiobook");
    expect(uids).not.toContain("cs-wait@studiobook");
    expect(uids).not.toContain("cs-cxl@studiobook");
  });

  it("does not leak sessions the member is not booked into", async () => {
    const repos = createInMemoryRepositories(seed());
    const m1 = await buildMemberCalendarFeed(repos, "caltok-m1", NOW_ISO);
    expect(m1?.events.map((event) => event.uid)).not.toContain("cs-up2@studiobook");
    const m2 = await buildMemberCalendarFeed(repos, "caltok-m2", NOW_ISO);
    expect(m2?.events.map((event) => event.uid).sort()).toEqual([
      "cs-up1@studiobook",
      "cs-up2@studiobook",
    ]);
  });

  it("returns null for an unknown token", async () => {
    const repos = createInMemoryRepositories(seed());
    expect(await buildMemberCalendarFeed(repos, "not-a-real-token", NOW_ISO)).toBeNull();
  });

  it("returns null for a blank token", async () => {
    const repos = createInMemoryRepositories(seed());
    expect(await buildMemberCalendarFeed(repos, "", NOW_ISO)).toBeNull();
    expect(await buildMemberCalendarFeed(repos, "   ", NOW_ISO)).toBeNull();
  });
});
