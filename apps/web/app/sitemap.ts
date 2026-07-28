import type { MetadataRoute } from "next";
import { publicBaseUrl, listPublicStudios, publicStudioUrl } from "@/lib/services/public-studio";

// Served at GET /sitemap.xml. Lists the crawlable public URLs: the landing page
// and every public studio page.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const studios = await listPublicStudios();
  return [
    {
      url: publicBaseUrl(),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
    ...studios.map((studio) => ({
      url: publicStudioUrl(studio.slug),
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1,
    })),
  ];
}
