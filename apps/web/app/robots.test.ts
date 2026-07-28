import { describe, it, expect } from "vitest";
import robots from "./robots";

describe("robots", () => {
  it("returns a robots object that allows indexing", () => {
    const result = robots();
    expect(result.rules.allow).toBe("/");
  });

  it("sets a sitemap URL ending in /sitemap.xml", () => {
    const result = robots();
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
