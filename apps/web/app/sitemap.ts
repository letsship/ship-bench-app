import type { MetadataRoute } from "next";
import { resolveRepositories } from "@/lib/db/repos";
import { getSiteUrl } from "@/lib/site";

// Resolves repositories per-request rather than being statically prerendered,
// so a build with no Supabase env vars set (e.g. CI's `pnpm build` step,
// which doesn't configure Supabase credentials) doesn't fail trying to
// evaluate the Supabase-backed repo at build time.
export const dynamic = "force-dynamic";

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
