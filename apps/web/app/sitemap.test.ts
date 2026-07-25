import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { __setTestRepositories } from "@/lib/db/repos";
import sitemap from "./sitemap";

describe("Sitemap", () => {
  beforeEach(() => {
    const seed = buildSeed();
    __setTestRepositories(createInMemoryRepositories(seed));
  });

  it("returns an array of sitemap entries", async () => {
    const entries = await sitemap();

    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });

  it("includes home URL", async () => {
    const entries = await sitemap();

    const homeEntry = entries.find((e) => !e.url.includes("/s/"));
    expect(homeEntry).toBeDefined();
    expect(homeEntry?.url).toMatch(/^https?:\/\//);
  });

  it("includes public studio pages with /s/ path", async () => {
    const entries = await sitemap();

    const studioEntry = entries.find((e) => e.url.includes("/s/"));
    expect(studioEntry).toBeDefined();
    expect(studioEntry?.url).toContain("/s/riverbank");
  });

  it("does not include auth-gated routes", async () => {
    const entries = await sitemap();

    expect(entries.every((e) => !e.url.includes("/(app)"))).toBe(true);
  });

  it("includes lastModified dates", async () => {
    const entries = await sitemap();

    entries.forEach((entry) => {
      expect(entry.lastModified).toBeDefined();
    });
  });
});
