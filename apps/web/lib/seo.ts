import type { Metadata } from "next";
import type { Studio } from "@/lib/db/types";
import { publicBaseUrl, publicStudioUrl, type PublicClass } from "@/lib/services/public-studio";

// SEO surface for the public studio page: studio-specific <title>/description,
// Open Graph + Twitter card tags, and the schema.org Event JSON-LD Google needs
// to render rich results for upcoming classes. URLs are built from the same
// publicBaseUrl/publicStudioUrl helpers the page and sitemap already share, so
// the canonical URL, sitemap entries, and OG url tag never drift apart.

export function getSiteUrl(): string {
  return publicBaseUrl();
}

export function buildStudioMetadata(studio: Studio): Metadata {
  const url = publicStudioUrl(studio.slug);
  const title = `${studio.name} | Studiobook`;
  const description = `See upcoming classes at ${studio.name} and book your next session.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: "Studiobook",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

interface StudioEventJsonLd {
  "@context": "https://schema.org";
  "@type": "Event";
  name: string;
  startDate: string;
  endDate: string;
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode";
  eventStatus: "https://schema.org/EventScheduled";
  location: {
    "@type": "Place";
    name: string;
  };
  performer: {
    "@type": "Person";
    name: string;
  };
  url: string;
}

export function buildStudioEventJsonLd(
  studio: Studio,
  classes: PublicClass[],
): StudioEventJsonLd[] {
  const url = publicStudioUrl(studio.slug);
  return classes.map((cls) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: cls.name,
    startDate: cls.startsAt,
    endDate: cls.endsAt,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: { "@type": "Place", name: studio.name },
    performer: { "@type": "Person", name: cls.instructor },
    url,
  }));
}
