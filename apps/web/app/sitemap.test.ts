import { afterEach, beforeEach, describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("sitemap.xml", () => {
  const savedSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    if (savedSiteUrl !== undefined) process.env.NEXT_PUBLIC_SITE_URL = savedSiteUrl;
    __setTestRepositories(null);
  });

  it("lists the public studio page", async () => {
    const entries = await sitemap();
    expect(entries).toHaveLength(1);
    expect(entries[0].url).toBe("http://localhost:3000/s/riverbank");
  });

  it("uses NEXT_PUBLIC_SITE_URL as the base when set", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://studiobook.example";
    const entries = await sitemap();
    expect(entries[0].url).toBe("https://studiobook.example/s/riverbank");
  });
});
