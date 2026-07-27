import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { listSessions } from "@/lib/services/classes";
import { studioMetadata, buildStudioEventsJsonLd } from "@/lib/seo";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("Public studio page (generateMetadata and JSON-LD)", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("studioMetadata includes studio name in title and description", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const studio = await repos.studios.getBySlug("riverbank");
    expect(studio).toBeDefined();
    if (!studio) return;

    const metadata = studioMetadata(studio);
    expect(metadata.title).toContain("Riverbank");
    expect(metadata.description).toContain("Riverbank");
  });

  it("studioMetadata includes canonical URL and OG tags", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const studio = await repos.studios.getBySlug("riverbank");
    expect(studio).toBeDefined();
    if (!studio) return;

    const metadata = studioMetadata(studio);
    expect(metadata.alternates?.canonical).toBe("/s/riverbank");
    expect(metadata.openGraph?.title).toContain("Riverbank");
    expect(metadata.openGraph?.type).toBe("website");
    expect(metadata.twitter?.card).toBe("summary");
  });

  it("buildStudioEventsJsonLd creates Event items with name, startDate, and location", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const studio = await repos.studios.getBySlug("riverbank");
    expect(studio).toBeDefined();
    if (!studio) return;

    const sessions = await listSessions(repos, studio.id, { from: NOW.toISOString() });
    const futureClasses = sessions.map((s) => ({
      name: s.classTypeName,
      startsAt: s.startsAt,
    }));

    const jsonLd = buildStudioEventsJsonLd(studio, futureClasses) as Record<string, unknown>;
    expect(jsonLd).toHaveProperty("@context", "https://schema.org");
    expect(jsonLd).toHaveProperty("@type", "ItemList");
    expect(Array.isArray(jsonLd.itemListElement)).toBe(true);

    if (futureClasses.length > 0) {
      const firstItem = (jsonLd.itemListElement as unknown[])[0];
      expect(firstItem.item).toHaveProperty("@type", "Event");
      expect(firstItem.item).toHaveProperty("name");
      expect(firstItem.item).toHaveProperty("startDate");
      expect(firstItem.item.location).toHaveProperty("name", studio.name);
    }
  });
});
