import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { listPublicStudios, publicStudioUrl, resolvePublicStudio } from "./public-studio";

// resolvePublicStudio filters "upcoming" against the real clock (new Date()),
// so — unlike fixture-anchored suites elsewhere — the seed must be built
// around the real clock too, or every seeded session lands in the past.
describe("resolvePublicStudio", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed()));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("resolves the studio and its upcoming classes for a known slug", async () => {
    const data = await resolvePublicStudio("riverbank");
    expect(data?.studio.name).toBe("Riverbank Movement");
    expect(data?.classes.length).toBeGreaterThan(0);
    for (const cls of data?.classes ?? []) {
      expect(cls.name).toBeTruthy();
      expect(cls.startsAt).toBeTruthy();
      expect(cls.instructor).toBeTruthy();
    }
  });

  it("returns null for a slug that matches no studio, so the page can 404", async () => {
    expect(await resolvePublicStudio("no-such-studio")).toBeNull();
  });
});

describe("listPublicStudios", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed()));
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
  it("builds an absolute URL under /s/<slug>", () => {
    expect(publicStudioUrl("riverbank")).toMatch(/\/s\/riverbank$/);
  });
});
