import type { MetadataRoute } from "next";
import { resolveRepositories } from "@/lib/db/repos";
import { listPublicStudios } from "@/lib/services/public-studio";
import { studioUrl } from "@/lib/seo/studio";

// Dynamic by design: the studio list comes from the live repository, so this
// must never be statically prerendered at build time (which has no Supabase
// credentials). Forcing dynamic also keeps Cloudflare Workers serving it fresh.
export const dynamic = "force-dynamic";

// GET /sitemap.xml — enumerates the public studio page(s) so search engines can
// discover them. One entry per crawlable studio, with an absolute URL and the
// studio's lastModified.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const repos = await resolveRepositories();
  const studios = await listPublicStudios(repos);
  return studios.map((studio) => ({
    url: studioUrl(studio.slug),
    lastModified: studio.createdAt,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));
}
