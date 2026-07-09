import type { MetadataRoute } from "next";
import { resolveRepositories } from "@/lib/db/repos";
import { listPublicStudios, publicBaseUrl, publicStudioUrl } from "@/lib/services/public-studio";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const repos = await resolveRepositories();
  const studios = await listPublicStudios(repos);

  return [
    { url: publicBaseUrl(), changeFrequency: "monthly", priority: 0.8 },
    ...studios.map((studio) => ({
      url: publicStudioUrl(studio.slug),
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
  ];
}
