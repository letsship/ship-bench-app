import type { MetadataRoute } from "next";
import { publicBaseUrl } from "@/lib/services/public-studio";

// GET /robots.txt — crawling is allowed everywhere the app is public. Only the
// JSON API is excluded: it serves no indexable content and would burn crawl
// budget. The authenticated admin routes redirect to /login for anonymous
// requests, so they need no explicit rule.

// Rendered per request, like sitemap.ts: prerendering would freeze the sitemap
// URL to whatever NEXT_PUBLIC_SITE_URL was at build time, which is the localhost
// fallback when the origin is only supplied at runtime — leaving robots.txt
// advertising a different host than the sitemap actually serves.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }],
    sitemap: `${publicBaseUrl()}/sitemap.xml`,
  };
}
