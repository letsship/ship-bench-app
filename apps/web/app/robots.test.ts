import { describe, it, expect } from "vitest";
import robots from "./robots";

describe("robots", () => {
  it("should allow all user agents to index the site", () => {
    const robotsOutput = robots();
    expect(robotsOutput.rules.userAgent).toBe("*");
    expect(robotsOutput.rules.allow).toBe("/");
  });

  it("should not disallow indexing of the root", () => {
    const robotsOutput = robots();
    expect(robotsOutput.rules.disallow).toBeUndefined();
  });

  it("should point sitemap to /sitemap.xml", () => {
    const robotsOutput = robots();
    expect(robotsOutput.sitemap).toContain("/sitemap.xml");
  });
});
