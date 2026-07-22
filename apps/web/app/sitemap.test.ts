import { describe, it, expect } from "vitest";
import sitemap from "./sitemap";

describe("sitemap.ts MetadataRoute", () => {
  it("should return array of sitemap entries", () => {
    const result = sitemap();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("should include home page in sitemap", () => {
    const result = sitemap();
    const homeEntry = result.find((entry) => entry.url.endsWith("/"));

    expect(homeEntry).toBeDefined();
    expect(homeEntry?.url).toMatch(/^https?:\/\/.*\/$/);
  });

  it("should include login page in sitemap", () => {
    const result = sitemap();
    const loginEntry = result.find((entry) => entry.url.includes("/login"));

    expect(loginEntry).toBeDefined();
    expect(loginEntry?.url).toMatch(/^https?:\/\/.*\/login$/);
  });

  it("should have valid entry structure", () => {
    const result = sitemap();

    result.forEach((entry) => {
      expect(entry).toHaveProperty("url");
      expect(entry).toHaveProperty("lastModified");
      expect(entry).toHaveProperty("changeFrequency");
      expect(entry).toHaveProperty("priority");

      expect(entry.url).toMatch(/^https?:\/\//);
      expect(entry.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]).toContain(
        entry.changeFrequency,
      );
      expect(typeof entry.priority).toBe("number");
      expect(entry.priority).toBeGreaterThanOrEqual(0);
      expect(entry.priority).toBeLessThanOrEqual(1);
    });
  });
});
