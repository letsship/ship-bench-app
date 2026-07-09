import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots", () => {
  it("allows crawling of the public site and points at the sitemap", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules.allow).toContain("/");
    expect(result.sitemap).toBe("http://localhost:3000/sitemap.xml");
  });

  it("disallows the authenticated app and API surface", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    const disallow = rules.disallow;
    expect(disallow).toEqual(
      expect.arrayContaining(["/dashboard", "/members", "/invoices", "/api/"]),
    );
  });
});
