import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories, resolveRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { listPublicStudios, publicStudioUrl, resolvePublicStudio } from "./public-studio";

// buildSeed() is anchored to the real clock (its sessions run from a week ago
// to a week ahead of `now`), and `resolvePublicStudio` filters against the real
// `new Date()` too — so the seed must use the real clock for "upcoming" to hold.
const NOW = new Date();

describe("public studio service", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("resolves a studio and its upcoming classes by slug", async () => {
    const data = await resolvePublicStudio("riverbank");
    expect(data?.studio.name).toBe("Riverbank Movement");
    expect(data?.classes.length).toBeGreaterThan(0);
    for (const cls of data?.classes ?? []) {
      expect(cls.name).toBeTruthy();
      expect(cls.startsAt).toBeTruthy();
      expect(cls.instructor).toBeTruthy();
      expect(new Date(cls.startsAt).getTime()).toBeGreaterThan(NOW.getTime());
    }
  });

  it("returns null for a slug that matches no studio", async () => {
    expect(await resolvePublicStudio("no-such-studio")).toBeNull();
  });

  it("excludes cancelled sessions from the upcoming classes shown to the public", async () => {
    const repos = await resolveRepositories();
    const before = await resolvePublicStudio("riverbank");
    const studioId = before?.studio.id;
    expect(studioId).toBeTruthy();

    const cancelled = await repos.classSessions.insert({
      id: "session-cancelled-test",
      studioId: studioId as string,
      classTypeId: "class-type-cancelled-test",
      instructor: "Someone",
      startsAt: new Date(NOW.getTime() + 60 * 60 * 1000).toISOString(),
      endsAt: new Date(NOW.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      capacity: 10,
      priceCents: 1000,
      status: "cancelled",
      createdAt: NOW.toISOString(),
    });

    const after = await resolvePublicStudio("riverbank");
    expect(after?.classes.some((cls) => cls.id === cancelled.id)).toBe(false);
    expect(after?.classes.length).toBe(before?.classes.length ?? 0);
  });

  it("lists every public studio for the sitemap", async () => {
    const studios = await listPublicStudios();
    expect(studios.some((studio) => studio.slug === "riverbank")).toBe(true);
  });

  it("builds an absolute canonical URL for a studio slug", () => {
    expect(publicStudioUrl("riverbank")).toBe("http://localhost:3000/s/riverbank");
  });
});
