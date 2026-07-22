import { describe, it, expect } from "vitest";
import robots from "./robots";

describe("robots.ts MetadataRoute", () => {
  it("should return valid robots.txt structure", () => {
    const result = robots();

    expect(result).toHaveProperty("rules");
    expect(result).toHaveProperty("sitemap");
  });

  it("should allow indexing of root path", () => {
    const result = robots();

    const rule = result.rules[0];
    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toBe("/");
  });

  it("should disallow indexing of API routes", () => {
    const result = robots();

    const rule = result.rules[0];
    expect(rule.disallow).toBe("/api");
  });

  it("should reference sitemap.xml", () => {
    const result = robots();

    expect(result.sitemap).toBeDefined();
    expect(result.sitemap).toContain("/sitemap.xml");
    expect(result.sitemap).toMatch(/^https?:\/\//);
  });

  it("should have user agent for all bots", () => {
    const result = robots();
    expect(result.rules[0].userAgent).toBe("*");
  });
});
