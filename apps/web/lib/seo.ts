import type { Metadata } from "next";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";
import { publicStudioUrl } from "@/lib/services/public-studio";

// Studio-specific SEO metadata for the public /s/[slug] page: title, meta
// description, Open Graph, and Twitter card all name the studio (never a
// hardcoded "Studio"), plus a canonical URL so search engines index one copy.
export function studioMetadata(studio: Studio): Metadata {
  const title = `${studio.name} — book a class`;
  const description = `See upcoming classes at ${studio.name} and book your spot.`;
  const url = publicStudioUrl(studio.slug);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: "website",
      url,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

// One schema.org Event per upcoming class, so Google can show rich results for
// this studio's schedule. https://schema.org/Event
export function studioEventsJsonLd(
  studio: Studio,
  classes: PublicClass[],
): Record<string, unknown>[] {
  return classes.map((cls) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: cls.name,
    startDate: cls.startsAt,
    endDate: cls.endsAt,
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
