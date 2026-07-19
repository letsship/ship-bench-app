import type { MetadataRoute } from "next";
import { resolveRepositories } from "@/lib/db/repos";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const repos = await resolveRepositories();
    const studios = await repos.studios.listAll();

    const entries: MetadataRoute.Sitemap = [
      {
        url: siteUrl(),
        changeFrequency: "weekly",
        priority: 1,
      },
      ...studios.map((studio) => ({
        url: `${siteUrl()}/s/${studio.slug}`,
        changeFrequency: "daily" as const,
        priority: 0.9,
      })),
    ];

    return entries;
  } catch {
    // If database is unavailable (e.g., during build), return just the root
    return [
      {
        url: siteUrl(),
        changeFrequency: "weekly",
        priority: 1,
      },
    ];
  }
}
