import { describe, expect, it, vi } from "vitest";
import type { Repositories } from "@/lib/db/repos/types";

vi.mock("@/lib/db/repos", () => ({
  resolveRepositories: vi.fn(),
}));

function mockRepos(slugs: string[]): Repositories {
  return {
    studios: {
      listAll: vi.fn().mockResolvedValue(
        slugs.map((slug) => ({
          id: slug,
          name: slug.charAt(0).toUpperCase() + slug.slice(1),
          slug,
          timezone: "UTC",
          createdAt: "2026-01-01T00:00:00.000Z",
        })),
      ),
    },
  } as Repositories;
}

describe("sitemap", () => {
  it("yields one entry per studio with a url ending in /s/<slug>", async () => {
    const { resolveRepositories } = await import("@/lib/db/repos");
    vi.mocked(resolveRepositories).mockResolvedValue(mockRepos(["riverbank"]));

    const { default: sitemap } = await import("./sitemap");
    const entries = await sitemap();
    expect(entries).toHaveLength(1);
    expect(entries[0].url).toMatch(/\/s\/riverbank$/);
  });

  it("uses the base URL from publicBaseUrl", async () => {
    const { resolveRepositories } = await import("@/lib/db/repos");
    vi.mocked(resolveRepositories).mockResolvedValue(mockRepos(["one"]));

    const { default: sitemap } = await import("./sitemap");
    const entries = await sitemap();
    expect(entries[0].url).toBe("http://localhost:3000/s/one");
  });
});