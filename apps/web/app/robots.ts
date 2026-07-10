import type { MetadataRoute } from "next";

// Served at GET /robots.txt via Next's file convention. The operator console
// (`/dashboard`, `/bookings`, etc.) requires a session anyway, but keeping it
// out of the crawl budget avoids search engines wasting time on login walls.
function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/bookings",
        "/classes",
        "/members",
        "/invoices",
        "/reports",
        "/settings",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
