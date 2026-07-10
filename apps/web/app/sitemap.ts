import type { MetadataRoute } from "next";
import { listPublicStudios, publicBaseUrl, publicStudioUrl } from "@/lib/services/public-studio";

// Next's sitemap.ts file convention — serves GET /sitemap.xml so crawlers can
// discover the home page and every public studio page without following links.
// force-dynamic keeps this off the static prerender path at build time — like
// the /s/[slug] page, it resolves repositories per-request, and a build
// without Supabase credentials configured (e.g. this repo's CI) would
// otherwise fail trying to prerender it statically.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const studios = await listPublicStudios();

  return [
    { url: publicBaseUrl(), changeFrequency: "weekly", priority: 0.8 },
    ...studios.map((studio) => ({
      url: publicStudioUrl(studio.slug),
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
  ];
}
