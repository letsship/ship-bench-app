import type { MetadataRoute } from "next";
import { listPublicStudios, publicBaseUrl, publicStudioUrl } from "@/lib/services/public-studio";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = publicBaseUrl();
  const entries: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "monthly", priority: 1 },
  ];

  try {
    const studios = await listPublicStudios();
    for (const studio of studios) {
      entries.push({
        url: publicStudioUrl(studio.slug),
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  } catch (error) {
    console.error("sitemap: failed to list public studios", error);
  }

  return entries;
}
