import type { MetadataRoute } from "next";
import { publicBaseUrl } from "@/lib/services/public-studio";

// Next's robots.ts file convention — serves GET /robots.txt. The authenticated
// operator console (and its API) is never meant to be crawled; the public
// marketing page and studio pages are.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/s/"],
      disallow: [
        "/dashboard",
        "/classes",
        "/bookings",
        "/members",
        "/invoices",
        "/reports",
        "/settings",
        "/api/",
      ],
    },
    sitemap: `${publicBaseUrl()}/sitemap.xml`,
  };
}
