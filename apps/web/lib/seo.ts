import type { Metadata, MetadataRoute } from "next";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";

// Pure SEO helpers for the public studio page (/s/[slug]) and the sitemap /
// robots file-convention routes. Deterministic and free of request, database,
// and framework concerns so the metadata/JSON-LD/sitemap logic is unit-testable
// under Vitest's node environment; the page and metadata routes wire data in.

// The site's public origin. Absolute URLs (canonical, Open Graph, JSON-LD,
// sitemap) need one; it comes from NEXT_PUBLIC_SITE_URL in a real deployment
// and falls back to localhost for dev/build/test, matching Next's own
// metadataBase default. Trailing slashes are stripped so URL joining never
// produces a double slash.
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function publicStudioPath(slug: string): string {
  return `/s/${slug}`;
}

export function publicStudioAbsoluteUrl(slug: string, baseUrl: string): string {
  return `${baseUrl}${publicStudioPath(slug)}`;
}

function studioDescription(studio: Studio, classCount: number): string {
  if (classCount === 0) {
    return `Upcoming classes at ${studio.name} — see the schedule, times, and instructors, and book your spot.`;
  }
  const noun = classCount === 1 ? "class" : "classes";
  return `${studio.name} has ${classCount} upcoming ${noun} — see times and instructors, and book your spot.`;
}

// Studio-specific <title>, meta description, Open Graph, Twitter card, and
// canonical URL for the public studio page. Deliberately indexable — no robots
// directive — so the page can rank in search.
export function studioMetadata(
  studio: Studio,
  classes: PublicClass[],
  baseUrl: string,
): Metadata {
  const title = `${studio.name} — upcoming classes`;
  const description = studioDescription(studio, classes.length);
  const canonical = publicStudioAbsoluteUrl(studio.slug, baseUrl);
  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
      siteName: studio.name,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

// One schema.org Event per upcoming class — the structured data Google needs
// to show class events as rich results.
export function studioEventsJsonLd(studio: Studio, classes: PublicClass[], baseUrl: string) {
  const pageUrl = publicStudioAbsoluteUrl(studio.slug, baseUrl);
  return classes.map((cls) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: cls.name,
    startDate: cls.startsAt,
    endDate: cls.endsAt,
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: studio.name,
    },
    organizer: {
      "@type": "Organization",
      name: studio.name,
      url: pageUrl,
    },
    url: pageUrl,
  }));
}

// Sitemap entries for every studio that has a public page.
export function studioSitemapEntries(studios: Studio[], baseUrl: string): MetadataRoute.Sitemap {
  return studios.map((studio) => ({
    url: publicStudioAbsoluteUrl(studio.slug, baseUrl),
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.8,
  }));
}
