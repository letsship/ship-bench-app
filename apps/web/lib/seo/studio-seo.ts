import type { Metadata } from "next";
import type { PublicClass } from "@/lib/services/public-studio";
import type { Studio } from "@/lib/db/types";
import { publicBaseUrl, publicStudioUrl } from "@/lib/services/public-studio";

export function buildStudioMetadata(studio: Studio, _classes: PublicClass[]): Metadata {
  const siteUrl = publicBaseUrl();
  const canonical = publicStudioUrl(studio.slug);
  const description = `Book classes at ${studio.name}. View upcoming schedules, instructors, and class times.`;

  return {
    title: studio.name,
    description,
    metadataBase: new URL(siteUrl),
    alternates: { canonical },
    openGraph: {
      title: studio.name,
      description,
      url: canonical,
      siteName: "Studiobook",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: studio.name,
      description,
    },
    robots: { index: true, follow: true },
  };
}

interface JsonLdEvent {
  "@context": "https://schema.org";
  "@type": "Event";
  name: string;
  startDate: string;
  endDate: string;
  location: { "@type": "Place"; name: string };
  performer: { "@type": "Person"; name: string };
}

export function buildEventsJsonLd(studio: Studio, classes: PublicClass[]): JsonLdEvent[] {
  return classes.map((cls) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: cls.name,
    startDate: cls.startsAt,
    endDate: cls.endsAt,
    location: { "@type": "Place", name: studio.name },
    performer: { "@type": "Person", name: cls.instructor },
  }));
}