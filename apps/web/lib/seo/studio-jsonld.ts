import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";

// Pure schema.org Event builder for the public studio page's JSON-LD block.
// Kept separate from the page component so it's unit-testable without a DOM.

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
}

export function buildStudioEventsJsonLd(
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
    location: { "@type": "Place", name: studio.name },
    performer: { "@type": "Person", name: cls.instructor },
    organizer: { "@type": "Organization", name: studio.name, url: canonicalUrl },
  }));
}
