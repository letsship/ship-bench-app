import type { MetadataRoute } from "next";
import { listPublicStudios, publicStudioUrl } from "@/lib/services/public-studio";

// Repo access (Supabase in production) must happen at request time, not build
// time: `next build` runs with no Supabase credentials in CI, so statically
// prerendering this route would fail before a single studio is ever fetched.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const studios = await listPublicStudios();
  return studios.map((studio) => ({
    url: publicStudioUrl(studio.slug),
    changeFrequency: "daily",
  }));
}
