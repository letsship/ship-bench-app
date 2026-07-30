import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { Studio } from "@/lib/db/types";
import { getPublicStudioBySlug, listPublicStudios } from "./public-studio";

// listSessions filters against the real clock (`new Date()`), so fixtures must
// be genuinely future/past relative to the real now — like services.test.ts.
const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 86_400_000 + 3_600_000).toISOString();
const PAST = new Date(NOW.getTime() - 86_400_000).toISOString();
const PAST_END = new Date(NOW.getTime() - 86_400_000 + 3_600_000).toISOString();

// buildSeed generates the canonical demo dataset; tests override the bits they
// care about while keeping the studio id consistent so sessions resolve.
function withOverrides(over: Partial<SeedData>): SeedData {
  const base = buildSeed(NOW);
  return {
    studio: over.studio ?? base.studio,
    settings: base.settings,
    members: base.members,
    classTypes: over.classTypes ?? base.classTypes,
    sessions: over.sessions ?? base.sessions,
    bookings: base.bookings,
    invoices: base.invoices,
    lineItems: base.lineItems,
    outbox: base.outbox,
  };
}

describe("public-studio service", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(withOverrides({}));
  });

  it("returns null for an unknown slug (drives a 404)", async () => {
    const data = await getPublicStudioBySlug(repos, "does-not-exist");
    expect(data).toBeNull();
  });

  it("resolves a known slug with only upcoming sessions and their instructor", async () => {
    const base = buildSeed(NOW);
    const studioId = base.studio.id;
    const seed = withOverrides({
      classTypes: [
        {
          id: "ct1",
          studioId,
          name: "Vinyasa Yoga",
          description: null,
          color: "#111111",
          defaultCapacity: 10,
          defaultPriceCents: 1000,
          createdAt: ISO,
        },
      ],
      sessions: [
        {
          id: "past",
          studioId,
          classTypeId: "ct1",
          instructor: "Ada",
          startsAt: PAST,
          endsAt: PAST_END,
          capacity: 10,
          priceCents: 1000,
          status: "scheduled",
          createdAt: ISO,
        },
        {
          id: "future",
          studioId,
          classTypeId: "ct1",
          instructor: "Bo",
          startsAt: FUTURE,
          endsAt: FUTURE_END,
          capacity: 10,
          priceCents: 1000,
          status: "scheduled",
          createdAt: ISO,
        },
      ],
    });
    repos = createInMemoryRepositories(seed);

    const data = await getPublicStudioBySlug(repos, base.studio.slug);
    expect(data).not.toBeNull();
    expect(data!.studio.slug).toBe(base.studio.slug);
    expect(data!.classes).toHaveLength(1);
    expect(data!.classes[0]).toEqual({
      id: "future",
      name: "Vinyasa Yoga",
      instructor: "Bo",
      startsAt: FUTURE,
      endsAt: FUTURE_END,
    });
  });

  it("listPublicStudios returns the crawlable studio(s)", async () => {
    const studios: Studio[] = await listPublicStudios(repos);
    expect(studios.length).toBeGreaterThanOrEqual(1);
    const base = buildSeed(NOW);
    expect(studios.some((s) => s.slug === base.studio.slug)).toBe(true);
  });
});
