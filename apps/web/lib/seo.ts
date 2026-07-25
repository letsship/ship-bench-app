import type { Metadata } from "next";
import type { Studio } from "./db/types";
import type { PublicClass } from "./services/public-studio";

// SEO metadata builders for the public studio page. Exported for both
// generateMetadata (async) and JSON-LD structured data (sync render).

export function publicBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function publicStudioUrl(slug: string): string {
  return `${publicBaseUrl()}/s/${slug}`;
}

// Build Next.js Metadata for the public studio page: studio-specific title,
// description, Open Graph tags, Twitter card, and canonical URL. No noindex —
// the page is freely indexable by search engines.
export function studioMetadata(studio: Studio): Metadata {
  const url = publicStudioUrl(studio.slug);
  return {
    title: `${studio.name} - Classes`,
    description: `Browse upcoming classes at ${studio.name}. Book your spot for a movement class today.`,
    openGraph: {
      type: "website",
      title: `${studio.name} - Classes`,
      description: `Browse upcoming classes at ${studio.name}. Book your spot for a movement class today.`,
      url,
    },
    twitter: {
      card: "summary",
      title: `${studio.name} - Classes`,
      description: `Browse upcoming classes at ${studio.name}. Book your spot for a movement class today.`,
    },
    alternates: {
      canonical: url,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

// Build schema.org Event JSON-LD structured data for Google's rich results.
// One Event per upcoming class, with name, startDate, and location.
export function studioEventsJsonLd(studio: Studio, classes: PublicClass[]): object[] {
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
  }));
}
