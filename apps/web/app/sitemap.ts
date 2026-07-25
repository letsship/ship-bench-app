import type { MetadataRoute } from "next";
import { listPublicStudios } from "@/lib/services/public-studio";
import { publicStudioUrl, publicBaseUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const homeUrl: MetadataRoute.Sitemap = [
    {
      url: publicBaseUrl(),
      lastModified: new Date().toISOString(),
    },
  ];

  try {
    const studios = await listPublicStudios();
    const studioUrls: MetadataRoute.Sitemap = studios.map((studio) => ({
      url: publicStudioUrl(studio.slug),
      lastModified: studio.createdAt,
    }));
    return [...homeUrl, ...studioUrls];
  } catch {
    return homeUrl;
  }
}
