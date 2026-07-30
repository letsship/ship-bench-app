import type { Metadata } from "next";
import type { PublicClass, PublicStudio } from "@/lib/services/public-studio";
import type { Studio } from "@/lib/db/types";

// Pure, framework-light SEO builders for the public studio page. No database,
// request, or email imports live here — this is the lib/domain seam, so the
// page stays thin and the SEO derivation is unit-testable against the in-memory
// fakes. The page, sitemap, and robots all reach through these helpers so the
// "what URL describes this studio" rule lives in exactly one place.

// The site's public origin. Absolute URLs (canonical, Open Graph, sitemap) need
// one; it comes from NEXT_PUBLIC_SITE_URL in a real deployment and falls back to
// a deterministic production-like URL for hermetic tests and local runs.
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return "https://studiobook.app";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export function studioPath(slug: string): string {
  return `/s/${slug}`;
}

export function studioUrl(slug: string): string {
  return `${siteUrl()}${studioPath(slug)}`;
}

export function sitemapUrl(): string {
  return `${siteUrl()}/sitemap.xml`;
}

// A short, studio-specific page description that names the studio and teases its
// upcoming classes — never a hardcoded "Studio".
export function studioDescription(studio: Studio, classes: PublicClass[]): string {
  const head = `Upcoming classes at ${studio.name}`;
  if (classes.length === 0) return `${head}. Book your spot online.`;
  const names = Array.from(new Set(classes.map((c) => c.name))).slice(0, 5);
  return `${head}: ${names.join(", ")}. Book your spot online.`;
}

// Build the Next Metadata object for the public studio page: a studio-named
// <title>, a <meta name="description">, Open Graph (og:title / og:description /
// og:type), a Twitter summary_large_image card, and a canonical URL.
export function buildStudioMetadata(studio: Studio, classes: PublicClass[]): Metadata {
  const description = studioDescription(studio, classes);
  const url = studioUrl(studio.slug);
  return {
    title: studio.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: studio.name,
      description,
      type: "website",
      url,
      siteName: studio.name,
    },
    twitter: {
      card: "summary_large_image",
      title: studio.name,
      description,
    },
  };
}

// One schema.org Event per upcoming class, JSON-serializable for a single
// <script type="application/ld+json">. Each event carries at least name,
// startDate, and location.
export function buildStudioEventsJsonLd(studio: Studio, classes: PublicClass[]): Record<string, unknown>[] {
  return classes.map((cls) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: cls.name,
    startDate: cls.startsAt,
    endDate: cls.endsAt,
    location: {
      "@type": "Place",
      name: studio.name,
    },
    organizer: {
      "@type": "Organization",
      name: studio.name,
      url: studioUrl(studio.slug),
    },
    performer: {
      "@type": "Person",
      name: cls.instructor,
    },
  }));
}

// Convenience wrapper used by the page: derive metadata from a resolved studio.
export function buildStudioPageMetadata(data: PublicStudio): Metadata {
  return buildStudioMetadata(data.studio, data.classes);
}

export function buildStudioPageJsonLd(data: PublicStudio): Record<string, unknown>[] {
  return buildStudioEventsJsonLd(data.studio, data.classes);
}
