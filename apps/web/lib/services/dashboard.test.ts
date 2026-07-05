import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { ClassSession, ClassType, Member } from "@/lib/db/types";
import { dayKey } from "@/lib/domain/dates";
import { getDashboard } from "./dashboard";
import { getStudioContext } from "./studio";

const ISO = "2026-01-01T00:00:00.000Z";

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

const session = (id: string, startsAt: string): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "I",
  startsAt,
  endsAt: startsAt,
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: ISO,
});

describe("getDashboard", () => {
  it("agrees on the same studio-timezone calendar day for todayIso and the today filter, even when the studio is ahead of UTC and near its own midnight", async () => {
    // 2026-01-14T23:30Z is 2026-01-15T00:30 in Europe/Amsterdam (UTC+1): the
    // studio's calendar day has already rolled over while UTC's has not.
    const now = "2026-01-14T23:30:00.000Z";
    const inStudioToday = "2026-01-14T23:45:00.000Z"; // 00:45 Amsterdam, same studio day as `now`
    const inUtcTodayOnly = "2026-01-14T20:00:00.000Z"; // 21:00 Amsterdam, previous studio day

    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        classTypes: [classType("ct1")],
        sessions: [session("cs1", inStudioToday), session("cs2", inUtcTodayOnly)],
      }),
    );

    const data = await getDashboard(repos, await getStudioContext(repos), { now: () => now });

    expect(data.todayIso).toBe(now);
    expect(dayKey(data.todayIso, "Europe/Amsterdam")).toBe("2026-01-15");
    expect(data.today.map((s) => s.id)).toEqual(["cs1"]);
  });

  it("agrees on the same studio-timezone calendar day when the studio is behind UTC and near its own midnight", async () => {
    // 2026-01-15T05:00Z is 2026-01-14T21:00 in America/Los_Angeles (UTC-8):
    // UTC's calendar day has already rolled over while the studio's has not.
    const now = "2026-01-15T05:00:00.000Z";
    const inStudioToday = "2026-01-15T04:00:00.000Z"; // 20:00 LA, same studio day as `now`
    const inNextUtcDayOnly = "2026-01-15T09:00:00.000Z"; // 01:00 LA next day, following studio day

    const repos = createInMemoryRepositories(
      baseSeed({
        studio: { id: "s1", name: "S", slug: "s", timezone: "America/Los_Angeles", createdAt: ISO },
        members: [member("m1")],
        classTypes: [classType("ct1")],
        sessions: [session("cs1", inStudioToday), session("cs2", inNextUtcDayOnly)],
      }),
    );

    const data = await getDashboard(repos, await getStudioContext(repos), { now: () => now });

    expect(data.todayIso).toBe(now);
    expect(dayKey(data.todayIso, "America/Los_Angeles")).toBe("2026-01-14");
    expect(data.today.map((s) => s.id)).toEqual(["cs1"]);
  });

  it("defaults to the real clock when no `now` override is injected", async () => {
    const repos = createInMemoryRepositories(baseSeed());
    const before = new Date().toISOString();
    const data = await getDashboard(repos, await getStudioContext(repos));
    const after = new Date().toISOString();

    expect(data.todayIso >= before).toBe(true);
    expect(data.todayIso <= after).toBe(true);
  });
});
