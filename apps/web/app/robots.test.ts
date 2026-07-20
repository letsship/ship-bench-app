import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots.ts", () => {
  it("allows crawling for all user agents", () => {
    const result = robots();
    expect(result.rules.userAgent).toBe("*");
    expect(result.rules.allow).toBe("/");
  });

  it("references the sitemap.xml", () => {
    const result = robots();
    expect(result.sitemap).toContain("/sitemap.xml");
  });
});
