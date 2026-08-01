import type { MetadataRoute } from "next";
import { listPublicStudios, publicBaseUrl } from "@/lib/services/public-studio";

export const dynamic = "force-dynamic";

export function buildSitemapEntries(
  studios: { slug: string; createdAt: string }[],
  baseUrl: string,
): MetadataRoute.Sitemap {
  return studios.map((studio) => ({
    url: `${baseUrl}/s/${studio.slug}`,
    lastModified: studio.createdAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemapEntries(await listPublicStudios(), publicBaseUrl());
}
