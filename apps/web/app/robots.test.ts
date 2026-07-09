import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots", () => {
  it("allows crawling the public site and references the sitemap", () => {
    const result = robots();

    expect(result.sitemap).toBe("http://localhost:3000/sitemap.xml");
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules?.userAgent).toBe("*");
    expect(rules?.allow).toBe("/");
  });
});
