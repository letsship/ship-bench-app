import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

// GET /robots.txt — crawling is allowed by default; only the authenticated app
// surfaces and the API are kept out of search. The public studio pages under
// /s/ stay fully crawlable, and the sitemap points crawlers at them.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/bookings",
        "/classes",
        "/dashboard",
        "/invoices",
        "/members",
        "/reports",
        "/settings",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
