import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("GET /robots.txt", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

  it("allows crawling", () => {
    expect(rules.some((rule) => rule?.userAgent === "*" && rule.allow === "/")).toBe(true);
  });

  it("references an absolute sitemap URL", () => {
    expect(result.sitemap).toMatch(/^https?:\/\//);
    expect(result.sitemap?.endsWith("/sitemap.xml")).toBe(true);
  });

  it("keeps the public studio pages crawlable", () => {
    const disallowed = rules.flatMap((rule) => [rule?.disallow ?? []].flat());
    expect(disallowed.every((path) => !"/s/riverbank".startsWith(path))).toBe(true);
  });
});
