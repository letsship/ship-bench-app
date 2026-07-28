import type { MetadataRoute } from "next";
import { publicBaseUrl, listPublicStudios, publicStudioUrl } from "@/lib/services/public-studio";

// Served at GET /sitemap.xml. Lists the crawlable public URLs: the landing page
// and every public studio page. Resolved per-request — `next build` runs without
// database env vars, so this must never be prerendered statically.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let studios: Awaited<ReturnType<typeof listPublicStudios>> = [];
  try {
    studios = await listPublicStudios();
  } catch (error) {
    console.error("sitemap: failed to list public studios", error);
  }
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
