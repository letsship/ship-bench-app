import type { MetadataRoute } from "next";
import { publicBaseUrl } from "@/lib/services/public-studio";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/login",
          "/dashboard",
          "/bookings",
          "/classes",
          "/invoices",
          "/members",
          "/reports",
          "/settings",
        ],
      },
    ],
    sitemap: `${publicBaseUrl()}/sitemap.xml`,
  };
}
