import { describe, it, expect } from "vitest";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("includes an entry whose url resolves to the site root", () => {
    const result = sitemap();
    expect(result).toHaveLength(1);
    expect(result[0].url).toMatch(/\/$|^https?:\/\/[^/]+$/);
  });
});
