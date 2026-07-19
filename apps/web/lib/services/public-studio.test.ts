import { beforeEach, describe, expect, it, vi } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession } from "@/lib/db/types";
import * as reposModule from "@/lib/db/repos";
import { resolvePublicStudio } from "./public-studio";

const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();
const PAST = new Date(NOW.getTime() - 7 * 86_400_000).toISOString();
const PAST_END = new Date(NOW.getTime() - 7 * 86_400_000 + 3_600_000).toISOString();

function baseSeed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: {
      id: "s1",
      name: "Yoga Flow",
      slug: "yoga-flow",
      timezone: "America/New_York",
      createdAt: ISO,
    },
    settings: {
      studioId: "s1",
      currency: "USD",
      taxRateBps: 900,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
    members: [],
    classTypes: [
      {
        id: "ct1",
        studioId: "s1",
        name: "Yoga",
        description: null,
        color: "#000",
        defaultCapacity: 10,
        defaultPriceCents: 1000,
        createdAt: ISO,
      },
    ],
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

describe("resolvePublicStudio", () => {
  let mockRepos: Repositories;

  beforeEach(async () => {
    mockRepos = await createInMemoryRepositories(baseSeed());
    vi.spyOn(reposModule, "resolveRepositories").mockResolvedValue(mockRepos);
  });

  it("returns studio and upcoming classes when slug matches", async () => {
    const futureSession: ClassSession = {
      id: "sess1",
      studioId: "s1",
      classTypeId: "ct1",
      instructor: "Jane",
      startsAt: FUTURE,
      endsAt: FUTURE_END,
      capacity: 10,
      priceCents: 1000,
      status: "active",
      createdAt: ISO,
    };

    mockRepos = await createInMemoryRepositories(
      baseSeed({
        sessions: [futureSession],
      }),
    );
    vi.spyOn(reposModule, "resolveRepositories").mockResolvedValue(mockRepos);

    const result = await resolvePublicStudio("yoga-flow");

    expect(result).not.toBeNull();
    expect(result?.studio.name).toBe("Yoga Flow");
    expect(result?.classes).toHaveLength(1);
    expect(result?.classes[0].name).toBe("Yoga");
    expect(result?.classes[0].instructor).toBe("Jane");
  });

  it("returns null when slug does not match", async () => {
    const result = await resolvePublicStudio("unknown-studio");

    expect(result).toBeNull();
  });

  it("filters out past sessions", async () => {
    const pastSession: ClassSession = {
      id: "sess1",
      studioId: "s1",
      classTypeId: "ct1",
      instructor: "Jane",
      startsAt: PAST,
      endsAt: PAST_END,
      capacity: 10,
      priceCents: 1000,
      status: "active",
      createdAt: ISO,
    };

    const futureSession: ClassSession = {
      id: "sess2",
      studioId: "s1",
      classTypeId: "ct1",
      instructor: "John",
      startsAt: FUTURE,
      endsAt: FUTURE_END,
      capacity: 10,
      priceCents: 1000,
      status: "active",
      createdAt: ISO,
    };

    mockRepos = await createInMemoryRepositories(
      baseSeed({
        sessions: [pastSession, futureSession],
      }),
    );
    vi.spyOn(reposModule, "resolveRepositories").mockResolvedValue(mockRepos);

    const result = await resolvePublicStudio("yoga-flow");

    expect(result?.classes).toHaveLength(1);
    expect(result?.classes[0].id).toBe("sess2");
  });

  it("returns multiple future sessions", async () => {
    const session1: ClassSession = {
      id: "sess1",
      studioId: "s1",
      classTypeId: "ct1",
      instructor: "Jane",
      startsAt: FUTURE,
      endsAt: FUTURE_END,
      capacity: 10,
      priceCents: 1000,
      status: "active",
      createdAt: ISO,
    };

    const session2: ClassSession = {
      id: "sess2",
      studioId: "s1",
      classTypeId: "ct1",
      instructor: "John",
      startsAt: new Date(NOW.getTime() + 10 * 86_400_000).toISOString(),
      endsAt: new Date(NOW.getTime() + 10 * 86_400_000 + 3_600_000).toISOString(),
      capacity: 10,
      priceCents: 1000,
      status: "active",
      createdAt: ISO,
    };

    mockRepos = await createInMemoryRepositories(
      baseSeed({
        sessions: [session1, session2],
      }),
    );
    vi.spyOn(reposModule, "resolveRepositories").mockResolvedValue(mockRepos);

    const result = await resolvePublicStudio("yoga-flow");

    expect(result?.classes).toHaveLength(2);
    expect(result?.classes[0].id).toBe("sess1");
    expect(result?.classes[1].id).toBe("sess2");
  });

  it("returns empty classes list when no upcoming sessions exist", async () => {
    const result = await resolvePublicStudio("yoga-flow");

    expect(result).not.toBeNull();
    expect(result?.classes).toHaveLength(0);
  });
});
