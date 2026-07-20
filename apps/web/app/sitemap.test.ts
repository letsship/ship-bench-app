import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import sitemap from "./sitemap";

describe("sitemap.ts", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed()));
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("includes an entry for the Riverbank Movement public page", async () => {
    const entries = await sitemap();
    expect(entries).toHaveLength(1);
    expect(entries[0].url).toContain("/s/riverbank");
  });

  it("entries have a lastModified date", async () => {
    const entries = await sitemap();
    expect(entries[0].lastModified).toBeDefined();
  });
});
