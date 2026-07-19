import { MetadataRoute } from "next";
import { listPublicStudios } from "@/lib/services/public-studio";
import { siteUrl } from "@/lib/seo/studio-metadata";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const studios = await listPublicStudios();
    return studios.map((studio) => ({
      url: `${siteUrl()}/s/${studio.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    return [];
  }
}
