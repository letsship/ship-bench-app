import type { MetadataRoute } from "next";
import { listPublicStudios, publicBaseUrl, publicStudioUrl } from "@/lib/services/public-studio";

// Lists every crawlable page: the marketing home plus one entry per public
// studio page. Auth-gated routes ((app)/*, /login) are intentionally excluded
// — they require a session and have nothing to rank for.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [{ url: publicBaseUrl(), lastModified: new Date() }];

  try {
    const studios = await listPublicStudios();
    for (const studio of studios) {
      entries.push({ url: publicStudioUrl(studio.slug), lastModified: new Date() });
    }
  } catch (error) {
    // The sitemap is generated at build time, when a real backend may not be
    // configured/seeded yet. Fall back to the static entries rather than
    // failing the build.
    console.error("sitemap: failed to list public studios", error);
  }

  return entries;
}
