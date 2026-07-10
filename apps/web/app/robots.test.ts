import { describe, expect, it } from "vitest";
import { publicBaseUrl } from "@/lib/services/public-studio";
import robots from "./robots";

describe("robots", () => {
  it("allows the public studio pages, disallows the authenticated app, and points at the sitemap", () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rule.allow).toContain("/s/");
    expect(rule.disallow).toContain("/dashboard");
    expect(rule.disallow).toContain("/api/");
    expect(result.sitemap).toBe(`${publicBaseUrl()}/sitemap.xml`);
  });
});
