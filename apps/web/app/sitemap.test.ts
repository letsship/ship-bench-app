import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import sitemap from "./sitemap";

const SITE = "https://studiobook.example";
const NOW = new Date("2026-03-15T12:00:00.000Z");

const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

describe("GET /sitemap.xml (against injected fake repositories)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = SITE;
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
    if (previousSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
  });

  it("lists the public studio page as an absolute URL", async () => {
    const entries = await sitemap();
    expect(entries.map((entry) => entry.url)).toContain(`${SITE}/s/riverbank`);
  });

  it("includes the home page", async () => {
    const entries = await sitemap();
    expect(entries.map((entry) => entry.url)).toContain(SITE);
  });

  it("emits only absolute URLs", async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) expect(entry.url.startsWith("https://")).toBe(true);
  });
});
