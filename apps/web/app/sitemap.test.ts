import { afterEach, describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

afterEach(() => {
  __setTestRepositories(null);
});

describe("sitemap", () => {
  it("lists the public studio page when a studio is provisioned", async () => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
    const entries = await sitemap();
    expect(entries).toHaveLength(1);
    expect(entries[0].url.endsWith("/s/riverbank")).toBe(true);
  });

  it("returns an empty list when no studio is provisioned", async () => {
    __setTestRepositories(createInMemoryRepositories());
    const entries = await sitemap();
    expect(entries).toEqual([]);
  });
});
