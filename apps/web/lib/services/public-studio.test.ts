import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { ClassSession, ClassType } from "@/lib/db/types";
import { getPublicStudioBySlug } from "./public-studio";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const ISO = NOW.toISOString();
const PAST = new Date(NOW.getTime() - 86_400_000).toISOString();
const SOON = new Date(NOW.getTime() + 3_600_000).toISOString();
const LATER = new Date(NOW.getTime() + 2 * 3_600_000).toISOString();

function baseSeed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: {
      id: "s1",
      name: "Riverbank Movement",
      slug: "riverbank",
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
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

const classType = (id: string): ClassType => ({
  id,
  studioId: "s1",
  name: "Vinyasa Flow",
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
  startsAt: SOON,
  endsAt: LATER,
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: ISO,
  ...over,
});

describe("getPublicStudioBySlug", () => {
  it("returns the studio and only future sessions, sorted ascending", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [
          session("past", { startsAt: PAST, endsAt: PAST }),
          session("later", { startsAt: LATER, instructor: "Sanne" }),
          session("soon", { startsAt: SOON, instructor: "Noor" }),
        ],
      }),
    );

    const result = await getPublicStudioBySlug(repos, "riverbank", NOW);

    expect(result.studio.name).toBe("Riverbank Movement");
    expect(result.upcomingClasses.map((c) => c.id)).toEqual(["soon", "later"]);
    expect(result.upcomingClasses[0]).toMatchObject({
      classTypeName: "Vinyasa Flow",
      instructor: "Noor",
      startsAt: SOON,
    });
  });

  it("throws a 404 HttpError for an unknown slug", async () => {
    const repos = createInMemoryRepositories(baseSeed());
    await expect(getPublicStudioBySlug(repos, "does-not-exist", NOW)).rejects.toMatchObject({
      status: 404,
    });
  });
});
