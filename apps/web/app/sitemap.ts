import type { MetadataRoute } from "next";
import { listPublicStudios, publicBaseUrl, publicStudioUrl } from "@/lib/services/public-studio";

// Mark this route as dynamic since it queries the database at request time
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const studios = await listPublicStudios();
    const baseUrl = publicBaseUrl();

    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 1,
      },
      {
        url: `${baseUrl}/login`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.8,
      },
      ...studios.map((studio) => ({
        url: publicStudioUrl(studio.slug),
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: 0.9,
      })),
    ];
  } catch {
    // During build time or when database is unavailable, return base URLs only
    const baseUrl = publicBaseUrl();
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 1,
      },
      {
        url: `${baseUrl}/login`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.8,
      },
    ];
  }
}
