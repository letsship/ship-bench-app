import { describe, it, expect } from "vitest";
import sitemap from "./sitemap";
import { siteUrl } from "@/lib/seo";

describe("sitemap", () => {
  it("should include the home URL", () => {
    const sitemapOutput = sitemap();
    const homeEntry = sitemapOutput.find((entry) => entry.url.includes(`${siteUrl}/`));
    expect(homeEntry).toBeDefined();
  });

  it("should include the login URL", () => {
    const sitemapOutput = sitemap();
    const loginEntry = sitemapOutput.find((entry) => entry.url.includes(`${siteUrl}/login`));
    expect(loginEntry).toBeDefined();
  });

  it("should have at least two entries", () => {
    const sitemapOutput = sitemap();
    expect(sitemapOutput.length).toBeGreaterThanOrEqual(2);
  });

  it("should have all URLs as absolute URLs starting with siteUrl", () => {
    const sitemapOutput = sitemap();
    sitemapOutput.forEach((entry) => {
      expect(entry.url).toMatch(/^https?:\/\//);
      expect(entry.url.startsWith(siteUrl)).toBe(true);
    });
  });
});
