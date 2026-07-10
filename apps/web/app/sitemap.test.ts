import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { publicBaseUrl, publicStudioUrl } from "@/lib/services/public-studio";
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

    expect(urls).toContain(publicBaseUrl());
    expect(urls).toContain(publicStudioUrl("riverbank"));
  });
});
