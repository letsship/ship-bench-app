import type { MetadataRoute } from "next";
import { listPublicStudios } from "@/lib/services/public-studio";
import { siteUrl } from "@/lib/seo";

// GET /sitemap.xml — lists every public studio page so search engines can
// discover them. Enumerates all studios the repo exposes (the demo dataset is
// single-studio today; listAll() keeps this correct once multiple studios exist).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const studios = await listPublicStudios();
  const base = siteUrl();
  return studios.map((studio) => ({
    url: `${base}/s/${studio.slug}`,
    lastModified: studio.createdAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));
}
