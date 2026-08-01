import { afterEach, beforeEach, describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("robots.txt", () => {
  const savedSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });
  afterEach(() => {
    if (savedSiteUrl !== undefined) process.env.NEXT_PUBLIC_SITE_URL = savedSiteUrl;
  });

  it("allows all crawlers and references the sitemap", () => {
    const result = robots();
    expect(result.rules).toMatchObject({ userAgent: "*", allow: "/" });
    expect(result.sitemap).toBe("http://localhost:3000/sitemap.xml");
  });

  it("builds the sitemap URL from NEXT_PUBLIC_SITE_URL when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://studiobook.example";
    expect(robots().sitemap).toBe("https://studiobook.example/sitemap.xml");
  });
});
