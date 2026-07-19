import { describe, expect, it } from "vitest";
import { siteUrl } from "@/lib/seo/studio-metadata";
import robots from "./robots";

describe("robots", () => {
  it("allows all crawlers to crawl the site", () => {
    const result = robots();
    expect(result.rules.userAgent).toBe("*");
    expect(result.rules.allow).toBe("/");
  });

  it("references the sitemap in the robots output", () => {
    const result = robots();
    expect(result.sitemap).toBe(`${siteUrl()}/sitemap.xml`);
  });
});
