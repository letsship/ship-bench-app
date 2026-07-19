import type { MetadataRoute } from "next";
import { listPublicStudios, publicBaseUrl } from "@/lib/services/public-studio";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const studios = await listPublicStudios();
    return studios.map((studio) => ({
      url: `${publicBaseUrl()}/s/${studio.slug}`,
      lastModified: studio.createdAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // If the database is unprovisioned, return an empty sitemap rather than
    // crashing the build. Search engines gracefully handle empty sitemaps.
    return [];
  }
}
