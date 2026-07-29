import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

// GET /robots.txt — allows crawling of the public site and points at the
// sitemap. The public /s/<slug> pages are intentionally indexable.
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
