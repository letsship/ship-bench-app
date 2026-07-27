import type { Metadata } from "next";
import type { Studio } from "@/lib/db/types";
import { publicStudioUrl } from "@/lib/services/public-studio";

interface PublicClass {
  name: string;
  startsAt: string;
}

// Generate studio-specific metadata for SEO
export function studioMetadata(studio: Studio): Metadata {
  const title = `${studio.name} — classes & schedule`;
  const description = `View upcoming classes and schedule at ${studio.name}.`;
  const canonical = `/s/${studio.slug}`;
  const url = publicStudioUrl(studio.slug);

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

// Build schema.org Event structured data for upcoming classes
export function buildStudioEventsJsonLd(studio: Studio, classes: PublicClass[]): object {
  const events = classes.map((cls) => ({
    "@type": "Event",
    name: cls.name,
    startDate: cls.startsAt,
    location: {
      "@type": "Place",
      name: studio.name,
    },
  }));

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: events.map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: event,
    })),
  };
}
