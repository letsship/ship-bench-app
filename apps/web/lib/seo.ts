import type { Metadata } from "next";
import type { Studio } from "@/lib/db/types";
import {
  type PublicClass,
  publicBaseUrl,
  publicStudioUrl,
} from "@/lib/services/public-studio";

// Pure SEO helpers so the /s/[slug] page, sitemap, and robots stay thin and the
// metadata/structured-data rules are unit-testable in the node test environment.

export { publicBaseUrl };

function studioDescription(studio: Studio): string {
  return `Book classes at ${studio.name}. Browse the upcoming class schedule, times, and instructors, and reserve your spot online.`;
}

// Next Metadata for a studio's public page: indexable, studio-specific title and
// description, Open Graph + Twitter previews, and a canonical URL.
export function buildStudioMetadata(studio: Studio): Metadata {
  const description = studioDescription(studio);
  const canonical = publicStudioUrl(studio.slug);
  return {
    title: `${studio.name} — Class schedule & bookings`,
    description,
    alternates: { canonical },
    openGraph: {
      title: studio.name,
      description,
      type: "website",
      url: canonical,
      siteName: "Studiobook",
    },
    twitter: {
      card: "summary",
      title: studio.name,
      description,
    },
  };
}

export interface JsonLdEvent {
  "@context": "https://schema.org";
  "@type": "Event";
  name: string;
  startDate: string;
  endDate: string;
  eventStatus: string;
  eventAttendanceMode: string;
  location: {
    "@type": "Place";
    name: string;
  };
  organizer: {
    "@type": "Organization";
    name: string;
    url: string;
  };
  performer?: {
    "@type": "Person";
    name: string;
  };
  url: string;
}

// One schema.org Event per upcoming class so Google can render rich results.
export function buildStudioJsonLd(studio: Studio, classes: PublicClass[]): JsonLdEvent[] {
  return classes.map((cls) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: cls.name,
    startDate: cls.startsAt,
    endDate: cls.endsAt,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: studio.name,
    },
    organizer: {
      "@type": "Organization",
      name: studio.name,
      url: publicStudioUrl(studio.slug),
    },
    ...(cls.instructor
      ? { performer: { "@type": "Person" as const, name: cls.instructor } }
      : {}),
    url: publicStudioUrl(studio.slug),
  }));
}
