import type { MetadataRoute } from "next";
import { resolveRepositories } from "@/lib/db/repos";

// Served at GET /sitemap.xml via Next's file convention. Studiobook is
// single-studio in the demo dataset (see lib/services/studio.ts), so this
// lists the root plus every public studio page — today that's exactly one.
// Rendered per-request (not statically at build time): it reads the studio
// repo, which needs live Supabase credentials that a build environment may
// not have — every other data-driven route in this app is dynamic too.
export const dynamic = "force-dynamic";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const repos = await resolveRepositories();
  const studio = await repos.studios.getFirst();

  const entries: MetadataRoute.Sitemap = [{ url: base, changeFrequency: "weekly", priority: 1 }];
  if (studio) {
    entries.push({
      url: `${base}/s/${studio.slug}`,
      changeFrequency: "daily",
      priority: 0.8,
    });
  }
  return entries;
}
