import { describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { listPublicStudios, publicStudioUrl, resolvePublicStudio } from "./public-studio";

// buildSeed() anchors its sessions to the real clock (three a day, from a week
// ago to a week ahead) and resolvePublicStudio filters by `new Date()`
// internally (not injectable), so these tests seed with the real "now" rather
// than a fixed date — a fixed seed date would drift out of the seeded window
// as real time passes and its "upcoming classes" would silently become empty.
const beforeNow = new Date().toISOString();

// resolvePublicStudio/listPublicStudios are the "what can a search engine crawler
// or anonymous visitor see" surface behind /s/[slug], the sitemap, and robots —
// covering the known-slug and unknown-slug (404) paths here is what the public
// page's SEO indexability guarantee (AC1) rests on.
describe("resolvePublicStudio", () => {
  it("resolves the studio and its upcoming classes for a known slug", async () => {
    __setTestRepositories(createInMemoryRepositories(buildSeed()));
    try {
      const data = await resolvePublicStudio("riverbank");
      expect(data?.studio.name).toBe("Riverbank Movement");
      expect(data?.classes.length).toBeGreaterThan(0);
      expect(data?.classes.every((cls) => cls.startsAt >= beforeNow)).toBe(true);
      for (const cls of data?.classes ?? []) {
        expect(cls.name).toBeTruthy();
        expect(cls.instructor).toBeTruthy();
        expect(cls.startsAt).toBeTruthy();
      }
    } finally {
      __setTestRepositories(null);
    }
  });

  it("returns null for a slug that matches no studio", async () => {
    __setTestRepositories(createInMemoryRepositories(buildSeed()));
    try {
      expect(await resolvePublicStudio("does-not-exist")).toBeNull();
    } finally {
      __setTestRepositories(null);
    }
  });
});

describe("listPublicStudios", () => {
  it("lists every studio that has a public page", async () => {
    __setTestRepositories(createInMemoryRepositories(buildSeed()));
    try {
      const studios = await listPublicStudios();
      expect(studios.map((studio) => studio.slug)).toContain("riverbank");
    } finally {
      __setTestRepositories(null);
    }
  });
});

describe("publicStudioUrl", () => {
  it("builds an absolute canonical URL for a slug", () => {
    expect(publicStudioUrl("riverbank")).toBe("http://localhost:3000/s/riverbank");
  });
});
