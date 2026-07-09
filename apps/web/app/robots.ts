import type { MetadataRoute } from "next";
import { publicBaseUrl } from "@/lib/services/public-studio";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/login",
        "/dashboard",
        "/bookings",
        "/classes",
        "/members",
        "/invoices",
        "/reports",
        "/settings",
      ],
    },
    sitemap: `${publicBaseUrl()}/sitemap.xml`,
  };
}
