import { describe, expect, it, vi } from "vitest";
import type { Studio } from "@/lib/db/types";
import * as publicStudioService from "@/lib/services/public-studio";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("includes public studio URLs in the sitemap", async () => {
    const mockStudios: Studio[] = [
      {
        id: "s1",
        name: "Yoga Flow",
        slug: "yoga-flow",
        timezone: "America/New_York",
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "s2",
        name: "CrossFit Elite",
        slug: "crossfit-elite",
        timezone: "America/Los_Angeles",
        createdAt: "2024-01-02T00:00:00Z",
      },
    ];

    vi.spyOn(publicStudioService, "listPublicStudios").mockResolvedValue(mockStudios);

    const result = await sitemap();

    expect(result).toHaveLength(2);
    expect(result[0].url).toContain("/s/yoga-flow");
    expect(result[1].url).toContain("/s/crossfit-elite");
    expect(result[0].changeFrequency).toBe("weekly");
    expect(result[0].priority).toBe(0.8);
  });

  it("returns an empty sitemap when there are no studios", async () => {
    vi.spyOn(publicStudioService, "listPublicStudios").mockResolvedValue([]);

    const result = await sitemap();

    expect(result).toHaveLength(0);
  });
});
