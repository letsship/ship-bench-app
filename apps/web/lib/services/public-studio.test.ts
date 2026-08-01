import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { listPublicStudios, resolvePublicStudio } from "@/lib/services/public-studio";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("public studio service (against injected fake repositories)", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("resolves the seeded studio by slug with only upcoming classes", async () => {
    const data = await resolvePublicStudio("riverbank", NOW);
    expect(data).not.toBeNull();
    expect(data?.studio.name).toBe("Riverbank Movement");
    expect(data?.classes.length).toBeGreaterThan(0);
    for (const cls of data?.classes ?? []) {
      expect(cls.name).toBeTruthy();
      expect(cls.instructor).toBeTruthy();
      expect(new Date(cls.startsAt).getTime()).toBeGreaterThanOrEqual(NOW.getTime());
    }
  });

  it("returns null for a slug no studio owns", async () => {
    expect(await resolvePublicStudio("no-such-studio", NOW)).toBeNull();
  });

  it("lists the studios the sitemap should enumerate", async () => {
    const studios = await listPublicStudios();
    expect(studios.map((studio) => studio.slug)).toEqual(["riverbank"]);
  });
});
