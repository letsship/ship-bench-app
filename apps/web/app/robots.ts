import type { MetadataRoute } from "next";
import { publicBaseUrl } from "@/lib/services/public-studio";

// Served at GET /robots.txt. Allows crawling of the public pages, keeps the
// authenticated admin area out of the index, and points crawlers at the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/login", "/api/"],
    },
    sitemap: `${publicBaseUrl()}/sitemap.xml`,
  };
}
