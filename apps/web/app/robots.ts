import type { MetadataRoute } from "next";
import { publicBaseUrl } from "@/lib/services/public-studio";

// Mark this route as dynamic since it needs to handle requests at runtime
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = publicBaseUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/(app)/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
