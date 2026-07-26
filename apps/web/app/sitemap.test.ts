import { afterEach, beforeEach, describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("sitemap", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("lists the home page and the public studio page as absolute URLs", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls.some((url) => /^https?:\/\//.test(url) && /\/$/.test(new URL(url).pathname))).toBe(
      true,
    );
    expect(urls).toContain("http://localhost:3000/s/riverbank");
    for (const url of urls) {
      expect(() => new URL(url)).not.toThrow();
    }
  });

  it("never leaks an auth-gated route", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    for (const url of urls) {
      expect(new URL(url).pathname).not.toMatch(
        /^\/(dashboard|members|classes|invoices|reports|settings|login)/,
      );
    }
  });
});
