import type { MetadataRoute } from "next";
import { siteUrl, studioSitemapEntries } from "@/lib/seo";
import { listPublicStudios } from "@/lib/services/public-studio";

// GET /sitemap.xml — every public studio page, so crawlers can discover and
// index them. Lives outside the (app) route group: no auth required.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const studios = await listPublicStudios();
  return studioSitemapEntries(studios, siteUrl());
}
