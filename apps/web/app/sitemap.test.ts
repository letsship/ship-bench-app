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

  it("lists the home page and every public studio page", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain("http://localhost:3000");
    expect(urls.some((url) => url.endsWith("/s/riverbank"))).toBe(true);
  });

  it("never lists authenticated app routes", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls.some((url) => url.includes("/dashboard"))).toBe(false);
    expect(urls.some((url) => url.includes("/login"))).toBe(false);
  });

  it("degrades to the base routes when studios cannot be listed", async () => {
    __setTestRepositories(null);
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].url).toBe("http://localhost:3000");
  });
});
