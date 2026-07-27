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

  it("includes static entries for home and login", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/login"))).toBe(true);
  });

  it("includes the seeded studio by slug", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.includes("/s/riverbank"))).toBe(true);
  });

  it("uses absolute URLs for all entries", async () => {
    const entries = await sitemap();
    entries.forEach((entry) => {
      expect(entry.url).toMatch(/^https?:\/\//);
    });
  });

  it("degrades to static entries on repository failure", async () => {
    __setTestRepositories(null);
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.length).toBe(2);
    expect(urls.some((u) => u.endsWith("/"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/login"))).toBe(true);
  });
});
