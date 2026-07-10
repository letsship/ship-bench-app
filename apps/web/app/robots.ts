import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

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
        "/login",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
