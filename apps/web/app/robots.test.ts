import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots.txt", () => {
  it("allows crawling of public studio pages", () => {
    const robotsConfig = robots();
    expect(robotsConfig.rules.allow).toContain("/s/");
  });

  it("disallows crawling of API and app routes", () => {
    const robotsConfig = robots();
    const disallow = Array.isArray(robotsConfig.rules.disallow)
      ? robotsConfig.rules.disallow
      : [robotsConfig.rules.disallow];
    expect(disallow).toContain("/api/");
    expect(disallow).toContain("/(app)");
  });

  it("references sitemap URL", () => {
    const robotsConfig = robots();
    expect(robotsConfig.sitemap).toContain("/sitemap.xml");
  });

  it("includes user-agent for all crawlers", () => {
    const robotsConfig = robots();
    expect(robotsConfig.rules.userAgent).toBe("*");
  });
});
