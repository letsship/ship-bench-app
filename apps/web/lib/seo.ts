import type { Metadata } from "next";
import type { Studio } from "@/lib/db/types";
import { type PublicClass, publicStudioUrl } from "@/lib/services/public-studio";

// Search-engine surface for the public studio page: the <head> metadata Next
// renders from `generateMetadata`, and the schema.org payload embedded as
// JSON-LD. Kept free of repositories and React so both are plain data that unit
// tests can assert on directly.

export function studioPageTitle(studio: Studio): string {
  return `${studio.name} — class schedule and booking`;
}

export function studioPageDescription(studio: Studio): string {
  return `See upcoming classes at ${studio.name}, with times and instructors, and book your next class online.`;
}

// Studio-specific metadata: a real title and description naming the studio, the
// Open Graph and Twitter tags that produce a link preview, and a canonical URL
// so the page consolidates its own ranking signals.
export function studioPageMetadata(studio: Studio): Metadata {
  const title = studioPageTitle(studio);
  const description = studioPageDescription(studio);
  const url = publicStudioUrl(studio.slug);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: "website", url, siteName: studio.name },
    twitter: { card: "summary", title, description },
  };
}

// Serialize a JSON-LD payload for embedding in a <script> element.
//
// A <script> is raw text: the parser ends it at the first "</" sequence, so a
// class name or instructor containing "</script>" would otherwise close the
// element early and let the rest of the value run as markup. Class and studio
// names are free-form user input, and this page is public, so every "<" is
// rewritten to its JSON unicode escape (what Next's own JSON-LD docs
// recommend), which keeps the payload inert. JSON parsers decode the escape
// back, so consumers still read the original characters.
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

// schema.org Event objects — one per upcoming class — so Google can render the
// schedule as rich results. Each carries at least name, startDate and location;
// `@context` is repeated per entry because the array is emitted as a whole.
export function studioEventsJsonLd(studio: Studio, classes: PublicClass[]): unknown[] {
  const url = publicStudioUrl(studio.slug);
  return classes.map((cls) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: cls.name,
    startDate: cls.startsAt,
    endDate: cls.endsAt,
    url,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: { "@type": "Place", name: studio.name },
    performer: { "@type": "Person", name: cls.instructor },
    organizer: { "@type": "Organization", name: studio.name, url },
  }));
}
