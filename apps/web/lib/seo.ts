import type { Metadata } from "next";
import type { PublicClass, PublicStudio } from "@/lib/services/public-studio";

// Pure, framework-light SEO builders. No request, database, or notification
// imports — they only shape data the public-studio service already resolved,
// so they stay unit-testable against plain fixtures. Shared by the /s/[slug]
// page (generateMetadata + JSON-LD), sitemap.ts, and robots.ts.

// The site's public origin. Absolute URLs (canonical, Open Graph, sitemap,
// robots) need one; it comes from NEXT_PUBLIC_SITE_URL in a real deployment and
// falls back to localhost for dev/build — matching Next's own metadataBase
// default and the public-studio service's fallback.
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

// Absolute URL of a studio's public page.
export function studioUrl(slug: string): string {
  return `${siteUrl()}/s/${slug}`;
}

// A short, studio-specific meta description that names the studio and what a
// visitor can do, so search results and social previews are not generic.
export function studioDescription(studio: PublicStudio["studio"]): string {
  return `Upcoming classes and bookings at ${studio.name}. Reserve a spot in our upcoming sessions.`;
}

// Next Metadata for a studio's public page: a studio-specific <title> and
// <meta name="description">, Open Graph + Twitter card previews, and a canonical
// URL. Deliberately emits NO noindex — these pages are meant to be indexed.
export function buildStudioMetadata({
  studio,
}: {
  studio: PublicStudio["studio"];
}): Metadata {
  const description = studioDescription(studio);
  const url = studioUrl(studio.slug);
  const title = `${studio.name} — upcoming classes & bookings`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: "website",
      url,
      siteName: studio.name,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

// schema.org Event structured data, one per upcoming class. Each event carries
// at least name, startDate, and location (the studio), plus endDate and the
// instructor as performer where available — what Google needs to show class
// events as rich results.
export function buildStudioEventsJsonLd({
  studio,
  classes,
}: {
  studio: PublicStudio["studio"];
  classes: PublicClass[];
}): Array<{
  "@type": "Event";
  name: string;
  startDate: string;
  endDate: string;
  location: { "@type": "Place"; name: string };
  performer: { "@type": "Person"; name: string };
}> {
  // One Event per upcoming class. When there are none, there is nothing to
  // mark up — the caller omits the script tag rather than emitting a stub.
  return classes.map((cls) => ({
    "@type": "Event" as const,
    name: cls.name,
    startDate: cls.startsAt,
    endDate: cls.endsAt,
    location: { "@type": "Place" as const, name: studio.name },
    performer: { "@type": "Person" as const, name: cls.instructor },
  }));
}
