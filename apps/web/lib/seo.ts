import type { Metadata } from "next";
import type { Studio } from "@/lib/db/types";
import { publicBaseUrl, publicStudioUrl, type PublicClass } from "@/lib/services/public-studio";

// SEO metadata + structured data for the public studio page, kept as pure
// builders so they're unit-testable without rendering React. The page
// (app/s/[slug]/page.tsx) is the only caller; the sitemap and robots files
// reuse publicBaseUrl/publicStudioUrl directly from lib/services/public-studio.

const COVER_IMAGE_PATH = "/studio-cover.svg";

// Title + description name the studio so search results and social previews
// are studio-specific rather than a generic "Studio" placeholder.
export function studioMetadata(studio: Studio): Metadata {
  const title = `${studio.name} — classes & schedule`;
  const description = `Browse upcoming classes at ${studio.name} and see class times and instructors. Book your spot today.`;
  const url = publicStudioUrl(studio.slug);
  const image = `${publicBaseUrl()}${COVER_IMAGE_PATH}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

// One schema.org Event per upcoming class, so Google can show rich results
// (https://schema.org/Event). location is a Place named after the studio —
// the app doesn't model a street address, so that's the most specific data
// available.
export function studioEventsJsonLd(studio: Studio, classes: PublicClass[]): object[] {
  return classes.map((cls) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: cls.name,
    startDate: cls.startsAt,
    endDate: cls.endsAt,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: studio.name,
    },
    performer: {
      "@type": "Person",
      name: cls.instructor,
    },
  }));
}
