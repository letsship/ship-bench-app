import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession } from "@/lib/db/types";
import { getDashboard } from "./dashboard";
import { getStudioContext } from "./studio";

const ISO = "2026-06-15T08:00:00.000Z";

function baseSeed(): SeedData {
  return {
    studio: {
      id: "s1",
      name: "S",
      slug: "s",
      timezone: "Europe/Amsterdam",
      createdAt: ISO,
    },
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
    sessions: [] as ClassSession[],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

function session(id: string, startsAt: string): ClassSession {
  return {
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
  };
}

describe("getDashboard", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories({
      ...baseSeed(),
      sessions: [
        session("cs1", "2026-06-14T21:00:00.000Z"), // yesterday in Amsterdam (23:00)
        session("cs2", "2026-06-15T06:00:00.000Z"), // today in Amsterdam (08:00)
        session("cs3", "2026-06-15T10:00:00.000Z"), // today in Amsterdam (12:00)
        session("cs4", "2026-06-16T06:00:00.000Z"), // tomorrow in Amsterdam
      ],
    });
  });

  it("filters today using the passed nowIso", async () => {
    const ctx = await getStudioContext(repos);
    const data = await getDashboard(repos, ctx, "2026-06-15T08:00:00.000Z");
    expect(data.today.map((s) => s.id)).toEqual(["cs2", "cs3"]);
  });

  it("counts upcoming sessions from the passed nowIso", async () => {
    const ctx = await getStudioContext(repos);
    const data = await getDashboard(repos, ctx, "2026-06-15T08:00:00.000Z");
    // cs2 starts at 06:00Z (before nowIso) so not upcoming
    expect(data.stats.upcomingSessions).toBe(2);
  });

  it("defaults to new Date() when nowIso is omitted", async () => {
    const ctx = await getStudioContext(repos);
    const data = await getDashboard(repos, ctx);
    expect(Array.isArray(data.today)).toBe(true);
    expect(data.stats).toBeDefined();
  });
});
