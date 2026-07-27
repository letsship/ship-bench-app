import type { MetadataRoute } from "next";
import { listPublicStudios, publicBaseUrl, publicStudioUrl } from "@/lib/services/public-studio";

// Reads the repository seam at request time, so it must not be statically
// prerendered at build time (no DB/env access is available then).
export const dynamic = "force-dynamic";

// Lists every public (no-auth) URL so crawlers can discover the studio pages.
// Never include anything under the auth-gated (app) route group.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const studios = await listPublicStudios();

  const base = publicBaseUrl();

  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/login`, changeFrequency: "monthly", priority: 0.3 },
    ...studios.map((studio) => ({
      url: publicStudioUrl(studio.slug),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
