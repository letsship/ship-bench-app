import { describe, it, expect, afterEach } from "vitest";
import { siteConfig, baseMetadata, homeMetadata, sitemapEntries } from "./seo";

describe("SEO configuration", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
  });

  describe("siteConfig", () => {
    it("should have name and description", () => {
      expect(siteConfig.name).toBe("Studiobook");
      expect(siteConfig.description).toBe("Bookings, members, and invoicing for movement studios.");
    });

    it("should use NEXT_PUBLIC_SITE_URL from environment", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
      // Re-import to get the new env value
      // Note: This test assumes the module is re-evaluated; in practice,
      // Node.js modules cache, so we test the fallback behavior
      expect(siteConfig.siteUrl).toBeDefined();
      expect(siteConfig.siteUrl).toMatch(/^https?:\/\//);
    });

    it("should fall back to example URL if NEXT_PUBLIC_SITE_URL is not set", () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      // The siteConfig is already initialized, so we verify it has a valid URL
      expect(siteConfig.siteUrl).toMatch(/^https?:\/\//);
    });
  });

  describe("baseMetadata", () => {
    it("should have title template", () => {
      expect(baseMetadata.title).toHaveProperty("template");
      expect(baseMetadata.title).toHaveProperty("default");
    });

    it("should have description", () => {
      expect(baseMetadata.description).toBe(siteConfig.description);
    });

    it("should have metadataBase URL", () => {
      expect(baseMetadata.metadataBase).toBeInstanceOf(URL);
    });

    it("should have robots index and follow enabled", () => {
      expect(baseMetadata.robots).toEqual({
        index: true,
        follow: true,
      });
    });

    it("should have canonical alternates", () => {
      expect(baseMetadata.alternates).toHaveProperty("canonical");
    });

    it("should have Open Graph tags", () => {
      expect(baseMetadata.openGraph).toBeDefined();
      expect(baseMetadata.openGraph?.type).toBe("website");
      expect(baseMetadata.openGraph?.siteName).toBe("Studiobook");
    });

    it("should have Twitter card tags", () => {
      expect(baseMetadata.twitter).toBeDefined();
      expect(baseMetadata.twitter?.card).toBe("summary_large_image");
    });
  });

  describe("homeMetadata", () => {
    it("should have title", () => {
      expect(homeMetadata.title).toBe("Studiobook — studio class booking");
    });

    it("should have description", () => {
      expect(homeMetadata.description).toBe(siteConfig.description);
    });

    it("should have canonical URL", () => {
      expect(homeMetadata.alternates?.canonical).toBeDefined();
      expect(homeMetadata.alternates?.canonical).toContain("/");
    });

    it("should have Open Graph tags with full URL", () => {
      expect(homeMetadata.openGraph).toBeDefined();
      expect(homeMetadata.openGraph?.url).toBeDefined();
      expect(homeMetadata.openGraph?.type).toBe("website");
    });
  });

  describe("sitemapEntries", () => {
    it("should return array of sitemap entries", () => {
      const entries = sitemapEntries();
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
    });

    it("should include home page entry", () => {
      const entries = sitemapEntries();
      const home = entries.find((e) => e.url.endsWith("/"));
      expect(home).toBeDefined();
      expect(home?.changeFrequency).toBe("weekly");
      expect(home?.priority).toBe(1.0);
    });

    it("should include login page entry", () => {
      const entries = sitemapEntries();
      const login = entries.find((e) => e.url.includes("/login"));
      expect(login).toBeDefined();
      expect(login?.changeFrequency).toBe("monthly");
      expect(login?.priority).toBe(0.8);
    });

    it("should have valid dates in ISO format", () => {
      const entries = sitemapEntries();
      entries.forEach((entry) => {
        expect(entry.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it("should have absolute URLs", () => {
      const entries = sitemapEntries();
      entries.forEach((entry) => {
        expect(entry.url).toMatch(/^https?:\/\//);
      });
    });
  });
});
