import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as icalTokenGet } from "@/app/api/ical/[token]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import { getMemberCalendar } from "./calendar";

// Anchored to the real clock: the service compares upcoming sessions against
// `new Date()` internally, so fixtures must be genuinely future/past.
const NOW = new Date();
const ISO = NOW.toISOString();
const PAST = new Date(NOW.getTime() - 7 * 86_400_000).toISOString();
const PAST_END = new Date(NOW.getTime() - 7 * 86_400_000 + 3_600_000).toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

function baseSeed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: "s1", name: "Studio", slug: "s", timezone: "Europe/Amsterdam", createdAt: ISO },
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

const MEMBER_A = {
  id: "member-a",
  studioId: "s1",
  name: "Member A",
  email: "a@e.co",
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
  calendarToken: "token-a",
};

const MEMBER_B = {
  id: "member-b",
  studioId: "s1",
  name: "Member B",
  email: "b@e.co",
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
  calendarToken: "token-b",
};

const CLASS_TYPE = {
  id: "type-1",
  studioId: "s1",
  name: "Vinyasa Flow",
  description: null,
  color: "#111111",
  defaultCapacity: 10,
  defaultPriceCents: 1800,
  createdAt: ISO,
};

const FUTURE_SESSION = {
  id: "session-future",
  studioId: "s1",
  classTypeId: "type-1",
  instructor: "Noor",
  startsAt: FUTURE,
  endsAt: FUTURE_END,
  capacity: 10,
  priceCents: 1800,
  status: "scheduled",
  createdAt: ISO,
};

const PAST_SESSION = {
  id: "session-past",
  studioId: "s1",
  classTypeId: "type-1",
  instructor: "Noor",
  startsAt: PAST,
  endsAt: PAST_END,
  capacity: 10,
  priceCents: 1800,
  status: "scheduled",
  createdAt: ISO,
};

describe("getMemberCalendar", () => {
  it("includes only the token-holder's upcoming booked sessions", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [MEMBER_A, MEMBER_B],
        classTypes: [CLASS_TYPE],
        sessions: [FUTURE_SESSION, PAST_SESSION],
        bookings: [
          // Member A: booked into the future session (should appear).
          {
            id: "b1",
            sessionId: FUTURE_SESSION.id,
            memberId: MEMBER_A.id,
            status: "booked",
            bookedAt: ISO,
            cancelledAt: null,
          },
          // Member A: attended the past session (should NOT appear — past).
          {
            id: "b2",
            sessionId: PAST_SESSION.id,
            memberId: MEMBER_A.id,
            status: "attended",
            bookedAt: PAST,
            cancelledAt: null,
          },
          // Member B: also booked into the future session (should NOT leak
          // into Member A's feed).
          {
            id: "b3",
            sessionId: FUTURE_SESSION.id,
            memberId: MEMBER_B.id,
            status: "booked",
            bookedAt: ISO,
            cancelledAt: null,
          },
        ],
      }),
    );

    const { member, events } = await getMemberCalendar(repos, MEMBER_A.calendarToken);
    expect(member.id).toBe(MEMBER_A.id);
    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe(`${FUTURE_SESSION.id}@studiobook`);
  });

  it("excludes a waitlisted booking on an upcoming session", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [MEMBER_A],
        classTypes: [CLASS_TYPE],
        sessions: [FUTURE_SESSION],
        bookings: [
          {
            id: "b1",
            sessionId: FUTURE_SESSION.id,
            memberId: MEMBER_A.id,
            status: "waitlisted",
            bookedAt: ISO,
            cancelledAt: null,
          },
        ],
      }),
    );

    const { events } = await getMemberCalendar(repos, MEMBER_A.calendarToken);
    expect(events).toHaveLength(0);
  });

  it("404s on an unknown token", async () => {
    const repos = createInMemoryRepositories(baseSeed({ members: [MEMBER_A] }));
    await expect(getMemberCalendar(repos, "not-a-real-token")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("404s on an empty or whitespace token", async () => {
    const repos = createInMemoryRepositories(baseSeed({ members: [MEMBER_A] }));
    await expect(getMemberCalendar(repos, "")).rejects.toMatchObject({ status: 404 });
    await expect(getMemberCalendar(repos, "   ")).rejects.toMatchObject({ status: 404 });
  });
});

describe("GET /api/ical/[token]", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns a text/calendar feed for a valid token", async () => {
    const [member] = await repos.members.listByStudio((await repos.studios.getFirst())!.id);
    const res = await icalTokenGet(new Request("http://localhost/api/ical/x"), {
      params: Promise.resolve({ token: member.calendarToken }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(await res.text()).toContain("BEGIN:VCALENDAR");
  });

  it("returns 404 for an unknown token", async () => {
    const res = await icalTokenGet(new Request("http://localhost/api/ical/x"), {
      params: Promise.resolve({ token: "made-up-token" }),
    });
    expect(res.status).toBe(404);
  });
});
