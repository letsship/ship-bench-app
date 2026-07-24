import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots.ts", () => {
  it("returns a well-formed Robots metadata object", () => {
    const result = robots();
    expect(result).toBeDefined();
    expect(result.rules).toBeDefined();
    expect(Array.isArray(result.rules)).toBe(true);
  });

  it("allows crawling of the root path", () => {
    const result = robots();
    const wildcard = result.rules.find((r) => r.userAgent === "*");
    expect(wildcard).toBeDefined();
    expect(wildcard?.allow).toContain("/");
  });

  it("includes the sitemap URL", () => {
    const result = robots();
    expect(result.sitemap).toBeDefined();
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/);
  });

  it("includes the host", () => {
    const result = robots();
    expect(result.host).toBeDefined();
    expect(result.host).toBeTruthy();
  });
});
