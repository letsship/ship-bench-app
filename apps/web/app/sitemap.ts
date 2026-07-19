import { MetadataRoute } from "next";
import { listPublicStudios } from "@/lib/services/public-studio";
import { siteUrl } from "@/lib/seo/studio-metadata";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const studios = await listPublicStudios();

  return studios.map((studio) => ({
    url: `${siteUrl()}/s/${studio.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
}
