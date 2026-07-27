import type { MetadataRoute } from "next";
import { listPublicStudios, publicBaseUrl } from "@/lib/services/public-studio";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = publicBaseUrl();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/login`, changeFrequency: "monthly", priority: 0.5 },
  ];

  try {
    const studios = await listPublicStudios();
    const studioEntries: MetadataRoute.Sitemap = studios.map((studio) => ({
      url: `${baseUrl}/s/${studio.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));
    return [...staticEntries, ...studioEntries];
  } catch (error) {
    console.error("Failed to generate studio sitemap entries:", error);
    return staticEntries;
  }
}
