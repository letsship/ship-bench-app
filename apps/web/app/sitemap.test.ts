import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";

describe("sitemap.ts", () => {
  it("returns an array of sitemap entries", () => {
    const result = sitemap();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes the home page URL", () => {
    const result = sitemap();
    const homeEntry = result.find((entry) => entry.url.endsWith("/"));
    expect(homeEntry).toBeDefined();
  });

  it("includes only absolute URLs", () => {
    const result = sitemap();
    result.forEach((entry) => {
      expect(entry.url).toMatch(/^https?:\/\//);
    });
  });

  it("does not leak auth-gated or app routes", () => {
    const result = sitemap();
    const urls = result.map((entry) => entry.url.toLowerCase());
    // Verify no /dashboard, /(app) routes, or other auth-only paths
    urls.forEach((url) => {
      expect(url).not.toMatch(/\/dashboard/i);
      expect(url).not.toMatch(/\/members/i);
      expect(url).not.toMatch(/\/bookings/i);
      expect(url).not.toMatch(/\/invoices/i);
      expect(url).not.toMatch(/\/reports/i);
      expect(url).not.toMatch(/\/classes/i);
      expect(url).not.toMatch(/\/settings/i);
    });
  });
});
