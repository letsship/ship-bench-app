import type { Metadata } from "next";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";

// Pure SEO builders for the public studio page. Kept out of lib/domain/ (they
// speak Next's Metadata shape and schema.org, not business rules) and free of
// I/O so both the page and the unit tests can call them directly.

export function buildStudioMetadata(
  studio: Studio,
  classes: PublicClass[],
  siteUrl: string,
): Metadata {
  const title = `${studio.name} — book a class`;
  const description =
    classes.length > 0
      ? `Book one of ${classes.length} upcoming classes at ${studio.name}, including ${classes[0].name} with ${classes[0].instructor}.`
      : `See the upcoming class schedule at ${studio.name} and book your spot.`;
  const canonical = `${siteUrl}/s/${studio.slug}`;
  return {
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

// One schema.org Event per upcoming class, for the page's JSON-LD script.
export function buildStudioEventJsonLd(
  studio: Studio,
  classes: PublicClass[],
  siteUrl: string,
): Record<string, unknown>[] {
  return classes.map((cls) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: cls.name,
    startDate: cls.startsAt,
    endDate: cls.endsAt,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: studio.name,
      url: `${siteUrl}/s/${studio.slug}`,
    },
    performer: {
      "@type": "Person",
      name: cls.instructor,
    },
    organizer: {
      "@type": "Organization",
      name: studio.name,
      url: `${siteUrl}/s/${studio.slug}`,
    },
  }));
}
