import type { MetadataRoute } from "next";
import { resolveRepositories } from "@/lib/db/repos";
import { absoluteUrl } from "@/lib/seo";

// Studiobook is single-studio today (see the comment in lib/services/studio.ts),
// so the sitemap lists that one provisioned studio's public page.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const repos = await resolveRepositories();
  const studio = await repos.studios.getFirst();
  if (!studio) return [];

  return [
    {
      url: absoluteUrl(`/s/${studio.slug}`),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];
}
