import type { MetadataRoute } from "next";
import { studioUrl } from "@/lib/seo";
import { listPublicStudios } from "@/lib/services/public-studio";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const studios = await listPublicStudios();

  return studios.map((studio) => ({
    url: studioUrl(studio.slug),
    lastModified: studio.createdAt,
  }));
}
