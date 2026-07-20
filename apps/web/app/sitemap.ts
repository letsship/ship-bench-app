import type { MetadataRoute } from "next";
import { listPublicStudios, publicBaseUrl } from "@/lib/services/public-studio";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const studios = await listPublicStudios();
  const baseUrl = publicBaseUrl();

  return studios.map((studio) => ({
    url: `${baseUrl}/s/${studio.slug}`,
    lastModified: studio.createdAt,
  }));
}
