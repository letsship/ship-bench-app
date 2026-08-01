import { describe, expect, it } from "vitest";
import { buildRobots } from "./robots";

describe("robots", () => {
  it("allows crawling and references the sitemap", () => {
    expect(buildRobots("https://example.com")).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: "https://example.com/sitemap.xml",
    });
  });
});
