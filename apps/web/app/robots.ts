import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/domain/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/s/",
      disallow: ["/api/", "/(app)"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
