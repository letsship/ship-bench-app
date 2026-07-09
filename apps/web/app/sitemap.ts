import type { MetadataRoute } from "next";
import { resolveRepositories } from "@/lib/db/repos";
import { listPublicStudios, publicBaseUrl, publicStudioUrl } from "@/lib/services/public-studio";

// Opt out of build-time static generation: resolving repositories touches the
// Supabase env vars (unset in a plain `next build`, e.g. in CI), and the studio
// list can change between deploys anyway. Rendered per-request instead, same as
// the /s/[slug] page itself.
export const dynamic = "force-dynamic";

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
