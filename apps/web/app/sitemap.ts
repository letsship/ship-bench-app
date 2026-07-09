import type { MetadataRoute } from "next";
import { resolveRepositories } from "@/lib/db/repos";
import { getSiteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const repos = await resolveRepositories();
  const studio = await repos.studios.getFirst();
  if (!studio) return [];

  return [
    {
      url: `${getSiteUrl()}/s/${studio.slug}`,
      lastModified: new Date(),
    },
  ];
}
