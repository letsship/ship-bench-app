import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import sitemap from "./sitemap";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("sitemap", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("includes home page and studio pages", async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].url).toContain("localhost");
  });

  it("includes studio page URL for public studios", async () => {
    const entries = await sitemap();
    const studioEntries = entries.filter((e) => e.url.includes("/s/"));
    expect(studioEntries.length).toBeGreaterThan(0);
    expect(studioEntries[0].url).toContain("/s/riverbank");
  });

  it("returns absolute URLs only", async () => {
    const entries = await sitemap();
    entries.forEach((entry) => {
      expect(entry.url).toMatch(/^https?:\/\//);
    });
  });

  it("does not include auth-gated routes", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.includes("/admin"))).toBe(false);
    expect(urls.some((u) => u.includes("/(app)"))).toBe(false);
  });
});
