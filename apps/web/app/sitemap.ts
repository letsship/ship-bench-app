import type { MetadataRoute } from "next";
import { listPublicStudios, publicBaseUrl, publicStudioUrl } from "@/lib/services/public-studio";

// GET /sitemap.xml — the home page plus every studio's public /s/<slug> page.
// Rendered per request because the set of studios lives in the database.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const studios = await listPublicStudios();
  return [
    { url: publicBaseUrl(), changeFrequency: "weekly", priority: 0.5 },
    ...studios.map((studio) => ({
      url: publicStudioUrl(studio.slug),
      changeFrequency: "daily" as const,
      priority: 1,
    })),
  ];
}
