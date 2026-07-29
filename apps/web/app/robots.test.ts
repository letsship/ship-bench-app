import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("GET /robots.txt", () => {
  it("allows crawling of all paths", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    expect(rules.some((rule) => rule.allow?.includes("/"))).toBe(true);
  });

  it("references the sitemap URL", () => {
    const result = robots();
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
