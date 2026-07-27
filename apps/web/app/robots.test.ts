import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots", () => {
  it("allows crawling and references the sitemap", () => {
    const result = robots();
    expect(result.rules).toMatchObject(
      expect.arrayContaining([expect.objectContaining({ userAgent: "*", allow: "/" })]),
    );
    expect(result.sitemap).toBe("http://localhost:3000/sitemap.xml");
  });

  it("keeps authenticated app routes out of the crawl", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const disallow = rules.flatMap((rule) => rule?.disallow ?? []);
    expect(disallow).toContain("/dashboard");
    expect(disallow).toContain("/api/");
  });
});
