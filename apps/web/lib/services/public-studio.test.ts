import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import { getPublicStudioBySlug } from "./public-studio";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("getPublicStudioBySlug", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed(NOW));
  });

  it("returns the studio and its upcoming classes for a known slug", async () => {
    const result = await getPublicStudioBySlug(repos, "riverbank", NOW.toISOString());
    expect(result).not.toBeNull();
    expect(result?.studio.slug).toBe("riverbank");
    expect(result?.studio.name).toBe("Riverbank Movement");
    expect(result?.classes.length).toBeGreaterThan(0);
    for (const cls of result?.classes ?? []) {
      expect(cls.name).toBeTruthy();
      expect(cls.startsAt >= NOW.toISOString()).toBe(true);
      expect(cls.instructor).toBeTruthy();
    }
  });

  it("excludes classes that already started", async () => {
    const all = await getPublicStudioBySlug(repos, "riverbank", "1970-01-01T00:00:00.000Z");
    const upcoming = await getPublicStudioBySlug(repos, "riverbank", NOW.toISOString());
    expect(all?.classes.length ?? 0).toBeGreaterThan(upcoming?.classes.length ?? 0);
  });

  it("returns null for an unknown slug", async () => {
    const result = await getPublicStudioBySlug(repos, "does-not-exist", NOW.toISOString());
    expect(result).toBeNull();
  });
});
