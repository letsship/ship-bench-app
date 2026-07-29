import { listPublicStudios, publicBaseUrl } from "@/lib/services/public-studio";

// Dynamically-generated at request time — depends on database data and cannot
// be prerendered at build time (no Supabase env vars available during build).
export const dynamic = "force-dynamic";

export default async function sitemap() {
  const baseUrl = publicBaseUrl();
  const studios = await listPublicStudios();

  const entries: Array<{ url: string; lastModified: Date; changeFrequency: string; priority: number }> = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
  ];

  for (const studio of studios) {
    entries.push({
      url: `${baseUrl}/s/${studio.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  return entries;
}