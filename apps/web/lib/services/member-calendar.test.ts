import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as icalTokenGet } from "@/app/api/ical/[token]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { buildMemberCalendarEvents } from "./member-calendar";

const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();
const PAST = new Date(NOW.getTime() - 7 * 86_400_000).toISOString();
const PAST_END = new Date(NOW.getTime() - 7 * 86_400_000 + 3_600_000).toISOString();

function baseSeed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: ISO },
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
  createdAt: ISO,
  calendarToken: `${id}-token`,
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
  createdAt: ISO,
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
  createdAt: ISO,
  ...over,
});

const booking = (
  id: string,
  sessionId: string,
  memberId: string,
  over: Partial<Booking> = {},
): Booking => ({
  id,
  sessionId,
  memberId,
  status: "booked",
  bookedAt: ISO,
  cancelledAt: null,
  ...over,
});

describe("buildMemberCalendarEvents", () => {
  it("returns only the token holder's upcoming booked sessions", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1"), member("m2")],
        sessions: [
          session("future-mine", { startsAt: FUTURE, endsAt: FUTURE_END }),
          session("past-mine", { startsAt: PAST, endsAt: PAST_END }),
          session("future-other", { startsAt: FUTURE, endsAt: FUTURE_END }),
        ],
        bookings: [
          booking("b1", "future-mine", "m1"),
          booking("b2", "past-mine", "m1"),
          booking("b3", "future-other", "m2"),
        ],
      }),
    );
    const events = await buildMemberCalendarEvents(repos, "Studio", "m1-token");
    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe("future-mine@studiobook");
    expect(events[0].title).toBe("Yoga");
  });

  it("excludes waitlisted and cancelled bookings (not seat-taking)", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1")],
        sessions: [session("cs1"), session("cs2")],
        bookings: [
          booking("b1", "cs1", "m1", { status: "waitlisted" }),
          booking("b2", "cs2", "m1", { status: "cancelled" }),
        ],
      }),
    );
    const events = await buildMemberCalendarEvents(repos, "Studio", "m1-token");
    expect(events).toHaveLength(0);
  });

  it("404s on an unknown token", async () => {
    const repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
    await expect(buildMemberCalendarEvents(repos, "Studio", "nope")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("404s on an empty or whitespace token", async () => {
    const repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
    await expect(buildMemberCalendarEvents(repos, "Studio", "")).rejects.toMatchObject({
      status: 404,
    });
    await expect(buildMemberCalendarEvents(repos, "Studio", "   ")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("GET /api/ical/[token] (against injected fake repositories)", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        members: [member("m1"), member("m2")],
        sessions: [
          session("future-mine", { startsAt: FUTURE, endsAt: FUTURE_END }),
          session("future-other", { startsAt: FUTURE, endsAt: FUTURE_END }),
        ],
        bookings: [booking("b1", "future-mine", "m1"), booking("b2", "future-other", "m2")],
      }),
    );
    __setTestRepositories(repos);
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns a text/calendar feed with only that member's sessions, cookie-free", async () => {
    const request = new NextRequest("http://localhost/api/ical/m1-token");
    const res = await icalTokenGet(request, { params: Promise.resolve({ token: "m1-token" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("future-mine@studiobook");
    expect(body).not.toContain("future-other@studiobook");
  });

  it("returns 404 for an unknown token", async () => {
    const request = new NextRequest("http://localhost/api/ical/bogus");
    const res = await icalTokenGet(request, { params: Promise.resolve({ token: "bogus" }) });
    expect(res.status).toBe(404);
  });
});
