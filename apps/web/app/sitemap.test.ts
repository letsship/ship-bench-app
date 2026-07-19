import { describe, expect, it, beforeEach } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Repositories } from "@/lib/db/repos/types";
import { __setTestRepositories } from "@/lib/db/repos";
import sitemap from "./sitemap";

const NOW = new Date();

describe("sitemap", () => {
  let repos: Repositories;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
  });

  it("includes studio public pages", async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
  });

  it("includes studio slug in URL", async () => {
    const entries = await sitemap();
    const firstEntry = entries[0];
    expect(firstEntry.url).toContain("/s/");
  });

  it("includes metadata for each entry", async () => {
    const entries = await sitemap();
    const firstEntry = entries[0];
    expect(firstEntry.lastModified).toBeTruthy();
    expect(firstEntry.changeFrequency).toBe("weekly");
    expect(firstEntry.priority).toBe(0.8);
  });

  it("returns empty array on error", async () => {
    __setTestRepositories(null);
    const entries = await sitemap();
    expect(Array.isArray(entries)).toBe(true);
  });
});
