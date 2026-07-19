import type { Metadata } from "next";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";

// Pure SEO helpers, framework-free so they're unit-testable.
// No Next/React imports — these work in tests and in server components alike.

export function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function studioMetadata(studio: Studio): Metadata {
  const baseUrl = siteUrl();
  const canonicalUrl = `${baseUrl}/s/${studio.slug}`;
  const title = `${studio.name} — class schedule & booking`;
  const description = `Find and book classes at ${studio.name}. Browse the schedule of upcoming fitness classes, see instructors, and join today.`;

  return {
    title,
    description,
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonicalUrl,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

interface EventJsonLd {
  "@context": string;
  "@type": string;
  name: string;
  startDate: string;
  location: {
    "@type": string;
    name: string;
  };
}

export function studioEventsJsonLd(studio: Studio, classes: PublicClass[]): EventJsonLd[] {
  return classes.map((cls) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: cls.name,
    startDate: cls.startsAt,
    location: {
      "@type": "Place",
      name: studio.name,
    },
  }));
}
