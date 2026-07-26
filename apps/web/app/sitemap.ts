import type { MetadataRoute } from "next";
import { listPublicStudios, publicBaseUrl, publicStudioUrl } from "@/lib/services/public-studio";

// Resolves repositories at request time (to enumerate provisioned studios), so
// it can't be statically prerendered at build time — same reason every
// repository-backed route in this app is force-dynamic.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = publicBaseUrl();
  const studios = await listPublicStudios();

  return [
    { url: baseUrl },
    { url: `${baseUrl}/login` },
    ...studios.map((studio) => ({ url: publicStudioUrl(studio.slug) })),
  ];
}
