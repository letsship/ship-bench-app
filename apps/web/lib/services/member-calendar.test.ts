import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, Member } from "@/lib/db/types";
import { listMemberUpcomingEvents, resolveMemberByToken } from "./member-calendar";

const ISO = "2026-03-01T00:00:00.000Z";
const NOW = "2026-03-15T12:00:00.000Z";
const PAST = "2026-03-10T09:00:00.000Z";
const FUTURE = "2026-03-20T09:00:00.000Z";

const member = (id: string, token: string): Member => ({
  id,
  studioId: "s1",
  name: `Member ${id}`,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  calendarToken: token,
  createdAt: ISO,
});

const booking = (id: string, sessionId: string, memberId: string, status: string): Booking => ({
  id,
  sessionId,
  memberId,
  status,
  bookedAt: ISO,
  cancelledAt: null,
});

function session(id: string, startsAt: string) {
  return {
    id,
    studioId: "s1",
    classTypeId: "ct1",
    instructor: "Noor",
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 3_600_000).toISOString(),
    capacity: 10,
    priceCents: 1800,
    status: "scheduled",
    createdAt: ISO,
  };
}

function buildRepos() {
  const seed: SeedData = {
    studio: { id: "s1", name: "Studio One", slug: "one", timezone: "UTC", createdAt: ISO },
    settings: {
      studioId: "s1",
      currency: "EUR",
      taxRateBps: 0,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
    members: [member("m1", "tok-m1"), member("m2", "tok-m2")],
    classTypes: [
      {
        id: "ct1",
        studioId: "s1",
        name: "Vinyasa Flow",
        description: null,
        color: "#5b8c5a",
        defaultCapacity: 10,
        defaultPriceCents: 1800,
        createdAt: ISO,
      },
    ],
    sessions: [
      session("past", PAST),
      session("future-booked", FUTURE),
      session("future-waitlisted", FUTURE),
      session("future-cancelled", FUTURE),
      session("future-other-member", FUTURE),
    ],
    bookings: [
      booking("b1", "past", "m1", "attended"),
      booking("b2", "future-booked", "m1", "booked"),
      booking("b3", "future-waitlisted", "m1", "waitlisted"),
      booking("b4", "future-cancelled", "m1", "cancelled"),
      booking("b5", "future-other-member", "m2", "booked"),
    ],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
  return createInMemoryRepositories(seed);
}

describe("resolveMemberByToken", () => {
  it("resolves the member holding the token", async () => {
    const repos = buildRepos();
    const found = await resolveMemberByToken(repos, "s1", "tok-m1");
    expect(found?.id).toBe("m1");
  });

  it("returns null for an unknown token", async () => {
    expect(await resolveMemberByToken(buildRepos(), "s1", "tok-nope")).toBeNull();
  });

  it("returns null for an empty token", async () => {
    expect(await resolveMemberByToken(buildRepos(), "s1", "")).toBeNull();
  });

  it("returns null when the member belongs to another studio", async () => {
    expect(await resolveMemberByToken(buildRepos(), "other-studio", "tok-m1")).toBeNull();
  });
});

describe("listMemberUpcomingEvents", () => {
  it("keeps only the member's booked seats on future sessions", async () => {
    const repos = buildRepos();
    const target = await repos.members.getById("m1");
    const events = await listMemberUpcomingEvents(repos, target as Member, {
      now: NOW,
      location: "Studio One",
    });
    expect(events.map((event) => event.uid)).toEqual(["future-booked@studiobook"]);
    expect(events[0]).toMatchObject({
      title: "Vinyasa Flow",
      startsAt: FUTURE,
      description: "Instructor: Noor",
      location: "Studio One",
    });
  });

  it("returns no events for a member with no upcoming booked sessions", async () => {
    const repos = buildRepos();
    const other = await repos.members.getById("m2");
    // m2's only booking is on future-other-member; drop it to exercise the
    // empty path via a member whose bookings are all excluded.
    await repos.bookings.update("b5", { status: "cancelled" });
    const events = await listMemberUpcomingEvents(repos, other as Member, { now: NOW });
    expect(events).toEqual([]);
  });
});
