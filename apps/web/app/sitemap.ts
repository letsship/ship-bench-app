import type { MetadataRoute } from "next";
import { studioUrl } from "@/lib/domain/seo";
import { listPublicStudios } from "@/lib/services/public-studio";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const studios = await listPublicStudios();
    return studios.map((studio) => ({
      url: studioUrl(studio.slug),
      lastModified: new Date(studio.createdAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    return [];
  }
}
