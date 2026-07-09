import type { Metadata } from "next";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";

// SEO builders for the public studio page, kept separate from rendering so
// title/description/JSON-LD shape can be unit-tested without a React renderer.

export function buildStudioMetadata(studio: Studio, canonicalUrl: string): Metadata {
  const title = `${studio.name} — Book a class`;
  const description = `See upcoming classes at ${studio.name} and book your spot online — schedules, instructors, and class times.`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
      siteName: studio.name,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export interface StudioEventJsonLd {
  "@context": "https://schema.org";
  "@type": "Event";
  name: string;
  startDate: string;
  endDate: string;
  eventStatus: "https://schema.org/EventScheduled";
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode";
  location: {
    "@type": "Place";
    name: string;
  };
  performer: {
    "@type": "Person";
    name: string;
  };
  organizer: {
    "@type": "Organization";
    name: string;
    url: string;
  };
  url: string;
}

export function buildStudioEventJsonLd(
  studio: Studio,
  classes: PublicClass[],
  canonicalUrl: string,
): StudioEventJsonLd[] {
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
    performer: {
      "@type": "Person",
      name: cls.instructor,
    },
    organizer: {
      "@type": "Organization",
      name: studio.name,
      url: canonicalUrl,
    },
    url: canonicalUrl,
  }));
}
