import { existsSync } from "node:fs";
import { join } from "node:path";
import type { MetadataRoute } from "next";

// Authenticated routes redirect unauthenticated crawlers to /login anyway (see
// app/(app)/layout.tsx), so keep them out of the crawl budget explicitly.
const DISALLOWED_APP_PATHS = [
  "/api/",
  "/dashboard",
  "/bookings",
  "/invoices",
  "/members",
  "/classes",
  "/reports",
  "/settings",
];

// A sitemap URL is only meaningful once a site origin is configured and a
// sitemap route actually exists to serve it. Read the var directly rather than
// through lib/env's clientEnv(), which also requires the (unrelated) Supabase
// vars to be set — robots.txt must build even without Supabase configured.
const sitemapUrl = (): string | undefined => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return undefined;
  if (!existsSync(join(process.cwd(), "app/sitemap.ts"))) return undefined;
  return `${siteUrl}/sitemap.xml`;
};

export default function robots(): MetadataRoute.Robots {
  const sitemap = sitemapUrl();

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login"],
      disallow: DISALLOWED_APP_PATHS,
    },
    ...(sitemap ? { sitemap } : {}),
  };
}
