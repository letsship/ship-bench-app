import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/services/public-studio";

// Served automatically at GET /robots.txt (Next.js file convention). Allows
// crawling everywhere and points crawlers at the sitemap.
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
