import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession, ClassType } from "@/lib/db/types";
import {
  buildStudioJsonLd,
  buildStudioMetaDescription,
  getPublicStudioPage,
} from "./public-studio";

const NOW = new Date();
const ISO = NOW.toISOString();
const PAST = new Date(NOW.getTime() - 7 * 86_400_000).toISOString();
const PAST_END = new Date(NOW.getTime() - 7 * 86_400_000 + 3_600_000).toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

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
  instructor: "Amara Okafor",
  startsAt: FUTURE,
  endsAt: FUTURE_END,
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: ISO,
  ...over,
});

describe("getPublicStudioPage", () => {
  it("returns null for an unknown slug", async () => {
    const repos: Repositories = createInMemoryRepositories(baseSeed());
    expect(await getPublicStudioPage(repos, "does-not-exist")).toBeNull();
  });

  it("returns the studio and only its upcoming sessions for a known slug", async () => {
    const repos: Repositories = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("past", { startsAt: PAST, endsAt: PAST_END }), session("future")],
      }),
    );

    const page = await getPublicStudioPage(repos, "riverbank");
    expect(page?.studio.name).toBe("Riverbank Movement");
    expect(page?.upcomingSessions.map((s) => s.id)).toEqual(["future"]);
  });
});

describe("buildStudioMetaDescription", () => {
  it("names the studio rather than a hardcoded string", () => {
    const description = buildStudioMetaDescription(baseSeed().studio);
    expect(description).toContain("Riverbank Movement");
  });
});

describe("buildStudioJsonLd", () => {
  it("builds one schema.org Event per session with name, startDate, and location", async () => {
    const repos: Repositories = createInMemoryRepositories(
      baseSeed({ classTypes: [classType("ct1")], sessions: [session("future")] }),
    );
    const page = await getPublicStudioPage(repos, "riverbank");
    const events = buildStudioJsonLd(
      page!.studio,
      page!.upcomingSessions,
      "https://example.com/s/riverbank",
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      "@type": "Event",
      name: "Yoga",
      startDate: FUTURE,
      location: { "@type": "Place", name: "Riverbank Movement" },
    });
  });
});
