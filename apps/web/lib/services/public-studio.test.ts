import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import {
  listPublicStudios,
  publicBaseUrl,
  publicStudioUrl,
  resolvePublicStudio,
} from "@/lib/services/public-studio";

// resolvePublicStudio filters "upcoming" against the real wall clock (it takes
// no injectable `now`), so the seed must be built around the real current time
// too — matching the convention in lib/services/services.test.ts.
const NOW = new Date();

describe("resolvePublicStudio", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("resolves the seeded slug with its studio and only future classes", async () => {
    const result = await resolvePublicStudio("riverbank");
    expect(result).not.toBeNull();
    expect(result?.studio.name).toBe("Riverbank Movement");
    expect(result?.classes.length).toBeGreaterThan(0);
    for (const cls of result?.classes ?? []) {
      expect(new Date(cls.startsAt).getTime()).toBeGreaterThan(NOW.getTime());
      expect(cls.name).toBeTruthy();
      expect(cls.instructor).toBeTruthy();
    }
  });

  it("returns null for a slug that matches no studio", async () => {
    const result = await resolvePublicStudio("does-not-exist");
    expect(result).toBeNull();
  });
});

describe("listPublicStudios", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("lists every studio with a public page", async () => {
    const studios = await listPublicStudios();
    expect(studios.map((studio) => studio.slug)).toContain("riverbank");
  });
});

describe("publicStudioUrl", () => {
  it("builds an absolute URL under the public base URL", () => {
    expect(publicStudioUrl("riverbank")).toBe(`${publicBaseUrl()}/s/riverbank`);
  });
});
