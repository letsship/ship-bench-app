import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { ClassSession, ClassType } from "@/lib/db/types";
import { getPublicStudioBySlug } from "./public-studio";

// Anchored to the real clock: the service compares against `new Date()`
// internally, so fixtures must be genuinely future/past.
const NOW = new Date();
const PAST = new Date(NOW.getTime() - 86_400_000).toISOString();
const FUTURE = new Date(NOW.getTime() + 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 86_400_000 + 3_600_000).toISOString();

const classType: ClassType = {
  id: "ct1",
  studioId: "s1",
  name: "Vinyasa Flow",
  description: null,
  color: "#5b8c5a",
  defaultCapacity: 16,
  defaultPriceCents: 1800,
  createdAt: NOW.toISOString(),
};

function session(over: Partial<ClassSession>): ClassSession {
  return {
    id: "sess1",
    studioId: "s1",
    classTypeId: classType.id,
    instructor: "Noor",
    startsAt: FUTURE,
    endsAt: FUTURE_END,
    capacity: 16,
    priceCents: 1800,
    status: "scheduled",
    createdAt: NOW.toISOString(),
    ...over,
  };
}

function baseSeed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: {
      id: "s1",
      name: "Riverbank Movement",
      slug: "riverbank",
      timezone: "Europe/Amsterdam",
      createdAt: NOW.toISOString(),
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
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

describe("getPublicStudioBySlug", () => {
  it("returns the studio and its upcoming sessions with instructor + start time", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({ sessions: [session({ id: "future1", startsAt: FUTURE })] }),
    );

    const result = await getPublicStudioBySlug(repos, "riverbank");

    expect(result?.studio.name).toBe("Riverbank Movement");
    expect(result?.upcomingSessions).toEqual([
      { id: "future1", name: "Vinyasa Flow", startsAt: FUTURE, instructor: "Noor" },
    ]);
  });

  it("excludes past sessions", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        sessions: [
          session({ id: "past1", startsAt: PAST }),
          session({ id: "future1", startsAt: FUTURE }),
        ],
      }),
    );

    const result = await getPublicStudioBySlug(repos, "riverbank");

    expect(result?.upcomingSessions.map((s) => s.id)).toEqual(["future1"]);
  });

  it("returns null for an unknown slug", async () => {
    const repos = createInMemoryRepositories(baseSeed());
    expect(await getPublicStudioBySlug(repos, "does-not-exist")).toBeNull();
  });
});
