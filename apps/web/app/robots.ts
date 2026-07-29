import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

// GET /robots.txt — allow all crawling and point at the sitemap so search
// engines can discover every public studio page.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
