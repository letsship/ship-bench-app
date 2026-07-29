import type { MetadataRoute } from "next";
import { listPublicStudios } from "@/lib/services/public-studio";
import { siteUrl } from "@/lib/seo";

// GET /sitemap.xml — lists the public studio page(s). One entry per studio that
// has a public /s/<slug> page, so crawlers can enumerate and index them all.
// Force-dynamic: the set of studios comes from the repository (Supabase in
// prod), so it must not be prerendered at build time.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const studios = await listPublicStudios();
  return studios.map((studio) => ({
    url: `${siteUrl()}/s/${studio.slug}`,
    lastModified: studio.createdAt,
  }));
}
