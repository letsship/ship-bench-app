import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import sitemap from "./sitemap";

describe("sitemap", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed()));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("lists one entry per public studio, at the site origin + /s/<slug>", async () => {
    const entries = await sitemap();
    expect(entries).toHaveLength(1);
    expect(entries[0].url).toBe("http://localhost:3000/s/riverbank");
  });
});
