import type { MetadataRoute } from "next";
import { resolveRepositories } from "@/lib/db/repos";
import { getSiteUrl } from "@/lib/site-url";

// Reads repositories at request time (Supabase creds aren't available at build
// time in this environment), matching the other repo-backed routes.
export const dynamic = "force-dynamic";

// Studiobook is single-studio in the demo dataset (see lib/services/studio.ts),
// so this lists the homepage plus the one seeded studio's public page via
// `getFirst()`. A genuinely multi-studio deployment would list every studio
// via a `listAll()`-style repo method instead.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const entries: MetadataRoute.Sitemap = [{ url: siteUrl }];

  const repos = await resolveRepositories();
  const studio = await repos.studios.getFirst();
  if (studio) {
    entries.push({ url: `${siteUrl}/s/${studio.slug}` });
  }

  return entries;
}
