import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/members",
        "/classes",
        "/invoices",
        "/bookings",
        "/reports",
        "/settings",
      ],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
