import { afterEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import sitemap from "./sitemap";

describe("sitemap", () => {
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("lists the home page, login, and each public studio page", async () => {
    __setTestRepositories(createInMemoryRepositories(buildSeed()));
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls.some((url) => url.endsWith("/login"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/s/riverbank"))).toBe(true);
  });

  it("never leaks an auth-gated route", async () => {
    __setTestRepositories(createInMemoryRepositories(buildSeed()));
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    for (const gated of [
      "dashboard",
      "bookings",
      "members",
      "invoices",
      "classes",
      "reports",
      "settings",
    ]) {
      expect(urls.some((url) => url.includes(gated))).toBe(false);
    }
  });
});
