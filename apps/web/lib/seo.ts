import type { Metadata } from "next";
import type { Studio } from "@/lib/db/types";
import {
  type PublicClass,
  publicBaseUrl,
  publicStudioUrl,
} from "@/lib/services/public-studio";

// Pure, unit-testable SEO helpers for the public studio page. The page and its
// generateMetadata delegate here so the metadata/structured-data shape is
// asserted in one place. No framework or request concerns — just data in,
// Metadata / JSON-LD out.

export interface StudioSeoInput {
  studio: Pick<Studio, "name" | "slug" | "timezone">;
  classes: PublicClass[];
}

// Human-readable, studio-specific description used for <meta name="description">
// and the Open Graph / Twitter descriptions. Names the studio and its upcoming
// classes so it is never a generic "Studio" placeholder.
export function studioSeoDescription(studio: StudioSeoInput["studio"], classes: PublicClass[]): string {
  const count = classes.length;
  if (count === 0) {
    return `See the class schedule at ${studio.name}. Book movement and studio sessions online.`;
  }
  const next = classes[0];
  return `Upcoming classes at ${studio.name}, including ${next.name} with ${next.instructor}. Book your spot online.`;
}

// Next Metadata for the public studio page: studio-specific title, description,
// canonical URL, Open Graph, and Twitter card. Deliberately does NOT set a
// `robots.noindex` so the page is indexable.
export function buildStudioMetadata({ studio, classes }: StudioSeoInput): Metadata {
  const description = studioSeoDescription(studio, classes);
  const url = publicStudioUrl(studio.slug);
  const title = `${studio.name} — class schedule & booking`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: studio.name,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

// schema.org Event JSON-LD, one entry per upcoming class. Each Event carries at
// least name, startDate, and location (the studio), plus endDate, eventStatus,
// and organizer so rich results have everything Google asks for.
export function buildStudioEventJsonLd({ studio, classes }: StudioSeoInput): object[] {
  const url = publicStudioUrl(studio.slug);
  const location = {
    "@type": "Place" as const,
    name: studio.name,
    address: studio.name,
  };
  const organizer = { "@type": "Organization" as const, name: studio.name, url };
  return classes.map((cls) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: cls.name,
    startDate: cls.startsAt,
    endDate: cls.endsAt,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location,
    organizer,
    url,
  }));
}

// Re-exported for the sitemap/robots helpers so there is a single source of the
// site origin. Reads NEXT_PUBLIC_SITE_URL (optional) with a localhost fallback.
export function siteUrl(): string {
  return publicBaseUrl();
}
