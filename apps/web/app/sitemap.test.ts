import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/db/seed-data";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import sitemap from "@/app/sitemap";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("GET /sitemap.xml", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("lists the public studio page URL for the seeded studio", async () => {
    const entries = await sitemap();
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.some((entry) => entry.url.endsWith("/s/riverbank"))).toBe(true);
  });
});
