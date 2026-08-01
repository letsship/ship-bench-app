import type { MetadataRoute } from "next";
import { listPublicStudios, publicStudioUrl } from "@/lib/services/public-studio";

// Rendered per request so it always reflects the live studio list, not a
// build-time snapshot (the OpenNext build has no database).
export const dynamic = "force-dynamic";

// GET /sitemap.xml — every public studio page, for search-engine discovery.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const studios = await listPublicStudios();
  return studios.map((studio) => ({
    url: publicStudioUrl(studio.slug),
    changeFrequency: "daily",
    priority: 1,
  }));
}
