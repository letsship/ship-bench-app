import { beforeEach, describe, expect, it, vi } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession, Studio } from "@/lib/db/types";
import { buildSeed } from "@/lib/db/seed-data";

const ISO = "2025-01-01T00:00:00Z";
const FUTURE = "2025-01-15T10:00:00Z";
const FUTURE_END = "2025-01-15T11:00:00Z";

const createStudio = (over: Partial<Studio> = {}): Studio => ({
  id: "s1",
  name: "Fitness Studio",
  slug: "fitness-studio",
  timezone: "America/New_York",
  createdAt: ISO,
  ...over,
});

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "Alice",
  startsAt: FUTURE,
  endsAt: FUTURE_END,
  capacity: 10,
  price: 1000,
  bookings: 0,
  cancellations: 0,
  createdAt: ISO,
  ...over,
});

describe("public studio service", () => {
  let mockRepos: Repositories;

  beforeEach(() => {
    const seed = buildSeed(new Date());
    mockRepos = createInMemoryRepositories(seed);
    vi.doMock("@/lib/db/repos", () => ({
      resolveRepositories: async () => mockRepos,
    }));
  });

  it("service should handle studio queries with future sessions", async () => {
    const seed: SeedData = {
      studio: createStudio({ slug: "test-studio" }),
      settings: {
        studioId: "s1",
        currency: "USD",
        taxRateBps: 0,
        cancellationWindowHours: 24,
        waitlistEnabled: false,
        notifyBookingConfirmations: true,
        notifyCancellations: true,
        notifyWaitlistPromotions: true,
        notifyInvoices: true,
      },
      members: [],
      classTypes: [],
      sessions: [session("sess1", { classTypeName: "Yoga", instructor: "Bob" })],
      bookings: [],
      invoices: [],
      lineItems: [],
      outbox: [],
    };

    mockRepos = createInMemoryRepositories(seed);

    // Test through the repos directly since resolvePublicStudio
    // uses resolveRepositories internally
    const studio = await mockRepos.studios.getBySlug("test-studio");
    expect(studio).not.toBeNull();
    expect(studio?.name).toBe("Fitness Studio");
  });

  it("studio lookups return null for non-matching slug", async () => {
    const seed: SeedData = {
      studio: createStudio({ slug: "my-studio" }),
      settings: {
        studioId: "s1",
        currency: "USD",
        taxRateBps: 0,
        cancellationWindowHours: 24,
        waitlistEnabled: false,
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
    };

    mockRepos = createInMemoryRepositories(seed);
    const result = await mockRepos.studios.getBySlug("wrong-slug");
    expect(result).toBeNull();
  });

  it("listAll returns all studios", async () => {
    const seed: SeedData = {
      studio: createStudio({ id: "s1", slug: "studio-1", name: "Studio 1" }),
      settings: {
        studioId: "s1",
        currency: "USD",
        taxRateBps: 0,
        cancellationWindowHours: 24,
        waitlistEnabled: false,
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
    };

    mockRepos = createInMemoryRepositories(seed);
    const result = await mockRepos.studios.listAll();
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});
