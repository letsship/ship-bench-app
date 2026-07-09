import { afterEach, describe, expect, it, vi } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import sitemap from "./sitemap";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("sitemap", () => {
  afterEach(() => {
    __setTestRepositories(null);
    vi.unstubAllEnvs();
  });

  it("includes the homepage and the seeded studio's public page", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://studiobook.example.com");
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));

    const entries = await sitemap();

    expect(entries.map((entry) => entry.url)).toEqual([
      "https://studiobook.example.com",
      "https://studiobook.example.com/s/riverbank",
    ]);
  });

  it("returns only the homepage (and does not throw) when no studio is seeded", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://studiobook.example.com");
    __setTestRepositories(createInMemoryRepositories());

    const entries = await sitemap();

    expect(entries.map((entry) => entry.url)).toEqual(["https://studiobook.example.com"]);
  });
});
