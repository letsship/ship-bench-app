import { afterEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import sitemap from "./sitemap";

describe("sitemap", () => {
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("lists the seeded studio's public page under the configured site URL", async () => {
    __setTestRepositories(createInMemoryRepositories(buildSeed()));
    const entries = await sitemap();
    expect(entries.map((entry) => entry.url)).toContain("http://localhost:3000/s/riverbank");
  });
});
