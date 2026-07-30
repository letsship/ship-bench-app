import { afterEach, beforeEach, describe, expect, it } from "vitest";
import robots from "./robots";

const SITE = "https://studiobook.example";

const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = SITE;
});
afterEach(() => {
  if (previousSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
});

describe("GET /robots.txt", () => {
  it("allows crawlers to crawl the site", () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule?.userAgent).toBe("*");
    expect(rule?.allow).toBe("/");
  });

  it("does not blanket-disallow crawling", () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    const disallow = rule?.disallow;
    const entries = disallow === undefined ? [] : [disallow].flat();
    expect(entries).not.toContain("/");
  });

  it("references the sitemap", () => {
    expect(robots().sitemap).toBe(`${SITE}/sitemap.xml`);
  });
});
