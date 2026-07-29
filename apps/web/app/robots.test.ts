import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/public-studio", () => ({
  publicBaseUrl: () => "http://localhost:3000",
}));

describe("robots", () => {
  it("allows crawling (not disallow-all)", async () => {
    const { default: robots } = await import("./robots");
    const result = robots();
    expect(result.rules.userAgent).toBe("*");
    expect(result.rules.allow).toBe("/");
    expect(result.rules.disallow).toBeUndefined();
  });

  it("references the sitemap URL", async () => {
    const { default: robots } = await import("./robots");
    const result = robots();
    expect(result.sitemap).toBe("http://localhost:3000/sitemap.xml");
  });
});