import type { MetadataRoute } from "next";
import { resolveRepositories } from "@/lib/db/repos";
import { buildStudioSitemapEntries, siteBaseUrl } from "@/lib/seo/studio-seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const repos = await resolveRepositories();
  const studio = await repos.studios.getFirst();

  return buildStudioSitemapEntries(studio ? [studio] : [], siteBaseUrl());
}
