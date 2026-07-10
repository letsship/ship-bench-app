import type { MetadataRoute } from "next";
import { resolveRepositories } from "@/lib/db/repos";
import { siteUrl } from "@/lib/env";

// Reads the repo layer, so it can't be statically prerendered at build time
// (the build step has neither Supabase secrets nor USE_FAKE_BACKENDS set) —
// same reasoning as the `dynamic = "force-dynamic"` exports on every other
// route that touches `resolveRepositories()`.
export const dynamic = "force-dynamic";

// The demo dataset is single-studio (see `getStudioContext`), so `getFirst()`
// covers every public studio page that exists today. A multi-studio backend
// would swap this for a `studios.listAll()`-style read.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteUrl();
  const repos = await resolveRepositories();
  const studio = await repos.studios.getFirst();

  const entries: MetadataRoute.Sitemap = [
    { url: origin, changeFrequency: "monthly", priority: 0.8 },
  ];

  if (studio) {
    entries.push({
      url: `${origin}/s/${studio.slug}`,
      changeFrequency: "daily",
      priority: 1,
    });
  }

  return entries;
}
