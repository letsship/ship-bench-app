import type { MetadataRoute } from "next";
import { publicBaseUrl } from "@/lib/services/public-studio";

// GET /robots.txt — allow crawling and point crawlers at the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${publicBaseUrl()}/sitemap.xml`,
  };
}
