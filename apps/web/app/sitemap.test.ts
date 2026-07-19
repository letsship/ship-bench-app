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

  it("includes the riverbank studio", async () => {
    const entries = await sitemap();
    const riverbank = entries.find((e) => e.url.includes("/s/riverbank"));
    expect(riverbank).toBeDefined();
  });

  it("entries have url and lastModified", async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
    entries.forEach((entry) => {
      expect(entry.url).toBeDefined();
      expect(entry.lastModified).toBeDefined();
    });
  });
});
