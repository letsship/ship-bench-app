import type { MetadataRoute } from "next";
import { listPublicStudios } from "@/lib/services/public-studio";
import { publicStudioUrl } from "@/lib/services/public-studio";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const studios = await listPublicStudios();

  return studios.map((studio) => ({
    url: publicStudioUrl(studio.slug),
    lastModified: studio.createdAt,
  }));
}
