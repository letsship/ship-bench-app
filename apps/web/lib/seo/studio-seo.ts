import type { Metadata } from "next";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";

export interface StudioEventLD {
  "@context": "https://schema.org";
  "@type": "Event";
  name: string;
  startDate: string;
  endDate: string;
  location: {
    "@type": "Place";
    name: string;
  };
}

export function siteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function canonicalStudioUrl(slug: string): string {
  return `${siteBaseUrl()}/s/${slug}`;
}

export function buildStudioMetadata({
  studio,
  sessionCount,
}: {
  studio: Studio;
  sessionCount: number;
}): Metadata {
  const title = `${studio.name} | Classes`;
  const description =
    sessionCount > 0
      ? `Upcoming classes at ${studio.name}. Book your spot.`
      : `${studio.name} - Studio for fitness classes.`;
  const canonical = canonicalStudioUrl(studio.slug);
  const ogImage = `${siteBaseUrl()}/studio-cover.svg`;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
      siteName: "Studiobook",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${studio.name} studio`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical,
    },
  };
}

export function buildStudioEventsJsonLd({
  studio,
  sessions,
}: {
  studio: Studio;
  sessions: PublicClass[];
}): StudioEventLD[] {
  return sessions.map((session) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: session.name,
    startDate: session.startsAt,
    endDate: session.endsAt,
    location: {
      "@type": "Place",
      name: studio.name,
    },
  }));
}
