import type { Metadata } from "next";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";

// Pure SEO builders for the public studio page. No I/O, no request access —
// testable in vitest node environment.

export function buildStudioMetadata(
  studio: Studio,
  classes: PublicClass[],
  siteUrl: string,
): Metadata {
  const upcomingCount = classes.length;
  const title = studio.name;
  const description =
    upcomingCount > 0
      ? `Upcoming classes at ${studio.name}. Book now.`
      : `Explore classes and memberships at ${studio.name}.`;
  const studioUrl = `${siteUrl}/s/${studio.slug}`;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: {
      canonical: studioUrl,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: studioUrl,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

interface SchemaEvent {
  "@context": string;
  "@type": string;
  name: string;
  startDate: string;
  location: {
    "@type": string;
    name: string;
  };
}

export function buildStudioJsonLd(studio: Studio, classes: PublicClass[]): SchemaEvent[] {
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
