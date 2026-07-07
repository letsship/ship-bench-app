import { afterEach, describe, expect, it, vi } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { ClassSession, ClassType } from "@/lib/db/types";
import type { StudioContext } from "./studio";
import { getDashboard } from "./dashboard";

const NOW_ISO = "2026-06-14T22:30:00.000Z"; // 00:30 on Monday 15 June in Amsterdam.

const classType: ClassType = {
  id: "ct1",
  studioId: "s1",
  name: "Flow",
  description: null,
  color: "#2563eb",
  defaultCapacity: 12,
  defaultPriceCents: 1500,
  createdAt: NOW_ISO,
};

function session(id: string, startsAt: string): ClassSession {
  return {
    id,
    studioId: "s1",
    classTypeId: "ct1",
    instructor: "Mina",
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 60 * 60_000).toISOString(),
    capacity: 12,
    priceCents: 1500,
    status: "scheduled",
    createdAt: NOW_ISO,
  };
}

function seed(sessions: ClassSession[]): SeedData {
  return {
    studio: {
      id: "s1",
      name: "Riverbank Movement",
      slug: "riverbank",
      timezone: "Europe/Amsterdam",
      createdAt: NOW_ISO,
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
    classTypes: [classType],
    sessions,
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

function context(): StudioContext {
  return {
    studio: {
      id: "s1",
      name: "Riverbank Movement",
      slug: "riverbank",
      timezone: "Europe/Amsterdam",
      createdAt: NOW_ISO,
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
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("getDashboard", () => {
  it("uses an explicit request instant to bucket today in the studio timezone", async () => {
    const repos = createInMemoryRepositories(
      seed([
        session("yesterday-in-amsterdam", "2026-06-14T20:00:00.000Z"),
        session("today-early-in-amsterdam", "2026-06-14T22:45:00.000Z"),
        session("today-later-in-amsterdam", "2026-06-15T08:00:00.000Z"),
      ]),
    );

    const data = await getDashboard(repos, context(), NOW_ISO);

    expect(data.today.map((item) => item.id)).toEqual([
      "today-early-in-amsterdam",
      "today-later-in-amsterdam",
    ]);
    expect(data.stats.upcomingSessions).toBe(2);
  });

  it("keeps supporting callers that omit nowIso", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_ISO));

    const repos = createInMemoryRepositories(
      seed([
        session("yesterday-in-amsterdam", "2026-06-14T20:00:00.000Z"),
        session("today-in-amsterdam", "2026-06-15T08:00:00.000Z"),
      ]),
    );

    const data = await getDashboard(repos, context());

    expect(data.today.map((item) => item.id)).toEqual(["today-in-amsterdam"]);
    expect(data.stats.upcomingSessions).toBe(1);
  });
});
