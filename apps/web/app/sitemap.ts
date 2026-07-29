import { resolveRepositories } from "@/lib/db/repos";
import type { MetadataRoute } from "next";
import { publicBaseUrl } from "@/lib/services/public-studio";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = publicBaseUrl();
  const repos = await resolveRepositories();
  const studios = await repos.studios.listAll();
  return studios.map((studio) => ({
    url: `${baseUrl}/s/${studio.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));
}