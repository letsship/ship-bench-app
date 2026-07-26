import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { listMemberCalendarEvents } from "./member-calendar";

// Anchored to the real clock: the service filters sessions against `new
// Date()` internally, so fixtures must be genuinely future/past.
const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();
const LATER = new Date(NOW.getTime() + 8 * 86_400_000).toISOString();
const LATER_END = new Date(NOW.getTime() + 8 * 86_400_000 + 3_600_000).toISOString();
const PAST = new Date(NOW.getTime() - 7 * 86_400_000).toISOString();
const PAST_END = new Date(NOW.getTime() - 7 * 86_400_000 + 3_600_000).toISOString();

const member = (id: string): Member => ({
  id,
  studioId: "s1",
  name: id,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
  calendarToken: `${id}-tok`,
});

const classType = (id: string, name: string): ClassType => ({
  id,
  studioId: "s1",
  name,
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

describe("listMemberCalendarEvents", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1"), member("m2")],
        classTypes: [classType("ct1", "Vinyasa Flow"), classType("ct2", "Reformer Pilates")],
        sessions: [
          session("own-upcoming", { classTypeId: "ct1", startsAt: FUTURE, endsAt: FUTURE_END }),
          session("own-waitlisted", { classTypeId: "ct1", startsAt: LATER, endsAt: LATER_END }),
          session("own-past", { classTypeId: "ct1", startsAt: PAST, endsAt: PAST_END }),
          session("other-upcoming", { classTypeId: "ct2", startsAt: LATER, endsAt: LATER_END }),
        ],
        bookings: [
          booking("b1", "own-upcoming", "m1"),
          booking("b2", "own-waitlisted", "m1", { status: "waitlisted" }),
          booking("b3", "own-past", "m1", { status: "attended" }),
          booking("b4", "other-upcoming", "m2"),
        ],
      }),
    );
  });

  it("includes only the member's own upcoming seat-taking session", async () => {
    const member1 = await repos.members.getById("m1");
    const events = await listMemberCalendarEvents(repos, member1!);
    expect(events).toEqual([
      {
        uid: "own-upcoming@studiobook",
        title: "Vinyasa Flow",
        startsAt: FUTURE,
        endsAt: FUTURE_END,
        description: "Instructor: Noor",
      },
    ]);
  });

  it("excludes another member's upcoming session", async () => {
    const member2 = await repos.members.getById("m2");
    const events = await listMemberCalendarEvents(repos, member2!);
    expect(events.map((event) => event.uid)).toEqual(["other-upcoming@studiobook"]);
  });
});
