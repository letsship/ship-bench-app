import type { MetadataRoute } from "next";
import { resolveRepositories } from "@/lib/db/repos";
import { getStudioPageUrl } from "@/lib/services/public-studio";

// Served automatically at GET /sitemap.xml (Next.js file convention). Lists
// every public studio page so crawlers can discover /s/[slug] without a link.
// force-dynamic (matching every other repo-backed route in this app) so
// resolveRepositories() runs per-request instead of at build time, when
// production Supabase credentials aren't available.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const repos = await resolveRepositories();
  const studio = await repos.studios.getFirst();
  if (!studio) return [];

  return [
    {
      url: getStudioPageUrl(studio),
      lastModified: new Date(studio.createdAt),
    },
  ];
}
