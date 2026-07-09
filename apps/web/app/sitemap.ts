import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";
import { listPublicStudios, publicStudioUrl } from "@/lib/services/public-studio";

// Lists studios at request time via the repository seam (Supabase in
// production), same as the page it mirrors — never prerendered at build time,
// where no database credentials are available.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const studios = await listPublicStudios();
  const home: MetadataRoute.Sitemap[number] = {
    url: getSiteUrl(),
    changeFrequency: "daily",
    priority: 1,
  };
  const studioPages: MetadataRoute.Sitemap = studios.map((studio) => ({
    url: publicStudioUrl(studio.slug),
    changeFrequency: "daily",
    priority: 0.8,
  }));
  return [home, ...studioPages];
}
