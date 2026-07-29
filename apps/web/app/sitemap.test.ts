import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import sitemap from "./sitemap";

describe("sitemap", () => {
  let repos: Repositories;

  beforeEach(() => {
    const seed = buildSeed(new Date("2026-07-01T12:00:00.000Z"));
    repos = createInMemoryRepositories(seed);
    __setTestRepositories(repos);
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("includes the home page", async () => {
    const entries = await sitemap();
    expect(entries.some((e) => e.url === "http://localhost:3000")).toBe(true);
  });

  it("includes the studio page URL with /s/<slug>", async () => {
    const entries = await sitemap();
    expect(entries.some((e) => e.url === "http://localhost:3000/s/riverbank")).toBe(true);
  });

  it("includes the studio page with a higher-priority entry", async () => {
    const entries = await sitemap();
    const studioEntry = entries.find((e) => e.url === "http://localhost:3000/s/riverbank");
    expect(studioEntry).toBeDefined();
    expect(studioEntry!.priority).toBe(0.8);
  });
});