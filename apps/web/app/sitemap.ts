import type { MetadataRoute } from "next";
import { listPublicStudios, publicBaseUrl } from "@/lib/services/public-studio";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = publicBaseUrl();
  const studios = await listPublicStudios();

  const studioEntries: MetadataRoute.Sitemap = studios.map((studio) => ({
    url: `${baseUrl}/s/${studio.slug}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...studioEntries,
  ];
}
