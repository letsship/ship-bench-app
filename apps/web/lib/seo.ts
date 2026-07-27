import type { Metadata } from "next";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";
import { publicStudioUrl } from "@/lib/services/public-studio";

// SEO metadata for the public /s/[slug] studio page. Kept as pure, node-testable
// helpers (no framework/request concerns) so the search-facing contract — title,
// description, Open Graph, Twitter card, canonical, structured data — has unit
// coverage independent of rendering the page itself.

export function studioDescription(studio: Studio): string {
  return `Book a class at ${studio.name}. See upcoming class times and instructors, and reserve your spot online.`;
}

export function studioMetadata(studio: Studio): Metadata {
  const title = studio.name;
  const description = studioDescription(studio);
  const url = publicStudioUrl(studio.slug);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

interface EventJsonLd {
  "@context": "https://schema.org";
  "@type": "Event";
  name: string;
  startDate: string;
  endDate: string;
  eventAttendanceMode: string;
  eventStatus: string;
  location: {
    "@type": "Place";
    name: string;
  };
  performer: {
    "@type": "Person";
    name: string;
  };
}

// One schema.org Event per upcoming class, so Google can surface rich results
// (https://schema.org/Event). `classes` is expected to already be filtered to
// upcoming sessions by the caller (`resolvePublicStudio`).
export function studioEventsJsonLd(studio: Studio, classes: PublicClass[]): EventJsonLd[] {
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
