import type { MetadataRoute } from "next";
import { listPublicStudios, publicStudioUrl } from "@/lib/services/public-studio";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const studios = await listPublicStudios();
  return studios.map((studio) => ({
    url: publicStudioUrl(studio.slug),
    changeFrequency: "daily",
  }));
}
