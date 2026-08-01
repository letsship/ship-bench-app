import { describe, expect, it } from "vitest";
import { buildSitemapEntries } from "./sitemap";

describe("sitemap", () => {
  it("lists each public studio page", () => {
    expect(
      buildSitemapEntries(
        [{ slug: "riverbank", createdAt: "2026-01-01T00:00:00.000Z" }],
        "https://example.com",
      ),
    ).toEqual([
      expect.objectContaining({
        url: "https://example.com/s/riverbank",
        lastModified: "2026-01-01T00:00:00.000Z",
      }),
    ]);
  });
});
