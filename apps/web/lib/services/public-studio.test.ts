import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { ClassSession, ClassType, Studio, StudioSettings } from "@/lib/db/types";
import { getPublicStudioBySlug } from "./public-studio";

const NOW = new Date();
const ISO = NOW.toISOString();
const PAST = new Date(NOW.getTime() - 3_600_000).toISOString();
const PAST_END = new Date(NOW.getTime() - 1_800_000).toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

const studio: Studio = {
  id: "s1",
  name: "Riverbank Movement",
  slug: "riverbank",
  timezone: "Europe/Amsterdam",
  createdAt: ISO,
};

const settings: StudioSettings = {
  studioId: "s1",
  currency: "EUR",
  taxRateBps: 900,
  cancellationWindowHours: 12,
  waitlistEnabled: true,
  notifyBookingConfirmations: true,
  notifyCancellations: true,
  notifyWaitlistPromotions: true,
  notifyInvoices: true,
};

const classType: ClassType = {
  id: "ct1",
  studioId: "s1",
  name: "Vinyasa Flow",
  description: null,
  color: "#111111",
  defaultCapacity: 10,
  defaultPriceCents: 1800,
  createdAt: ISO,
};

function baseSeed(sessions: ClassSession[]): SeedData {
  return {
    studio,
    settings,
    members: [],
    classTypes: [classType],
    sessions,
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

describe("getPublicStudioBySlug", () => {
  it("returns the studio and only its upcoming sessions", async () => {
    const repos = createInMemoryRepositories(
      baseSeed([
        {
          id: "past",
          studioId: "s1",
          classTypeId: "ct1",
          instructor: "Noor",
          startsAt: PAST,
          endsAt: PAST_END,
          capacity: 10,
          priceCents: 1800,
          status: "scheduled",
          createdAt: ISO,
        },
        {
          id: "future",
          studioId: "s1",
          classTypeId: "ct1",
          instructor: "Sanne",
          startsAt: FUTURE,
          endsAt: FUTURE_END,
          capacity: 10,
          priceCents: 1800,
          status: "scheduled",
          createdAt: ISO,
        },
      ]),
    );

    const view = await getPublicStudioBySlug(repos, "riverbank");
    expect(view.studio.name).toBe("Riverbank Movement");
    expect(view.upcomingSessions.map((s) => s.id)).toEqual(["future"]);
    expect(view.upcomingSessions[0].instructor).toBe("Sanne");
  });

  it("throws a 404 HttpError for an unknown slug", async () => {
    const repos = createInMemoryRepositories(baseSeed([]));
    await expect(getPublicStudioBySlug(repos, "nope")).rejects.toMatchObject({ status: 404 });
  });
});
