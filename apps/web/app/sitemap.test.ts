import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import sitemap from "./sitemap";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// sitemap() is a Next file-convention export with no params, so it resolves
// its own repositories via resolveRepositories() — inject through the same
// test seam the route-handler tests use, rather than passing repos directly.
describe("sitemap", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("lists the root page and the seeded studio's public page", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain("http://localhost:3000");
    expect(urls).toContain("http://localhost:3000/s/riverbank");
  });
});
