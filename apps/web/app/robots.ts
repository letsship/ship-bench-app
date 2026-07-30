import type { MetadataRoute } from "next";
import { sitemapUrl } from "@/lib/seo/studio";

// GET /robots.txt — allows all crawlers access to the whole site (the public
// studio pages are now indexable) and points them at the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: sitemapUrl(),
  };
}
