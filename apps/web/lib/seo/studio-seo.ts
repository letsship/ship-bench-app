import type { Metadata } from "next";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";

export interface StudioMetadataInput {
  studio: Studio;
  url: string;
}

export interface StudioJsonLdInput {
  studio: Studio;
  sessions: PublicClass[];
  url: string;
}

export function buildStudioMetadata(input: StudioMetadataInput): Metadata {
  const { studio, url } = input;
  const title = `${studio.name} — classes & schedule`;
  const description = `Book classes at ${studio.name}. View upcoming sessions and join our fitness community.`;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: "website",
      url,
      siteName: "Studiobook",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: url,
    },
  };
}

export interface SchemaEvent {
  "@context": string;
  "@type": string;
  name: string;
  startDate: string;
  location: {
    "@type": string;
    name: string;
  };
}

export function buildStudioJsonLd(input: StudioJsonLdInput): SchemaEvent[] {
  const { studio, sessions } = input;

  return sessions.map((session) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: session.name,
    startDate: session.startsAt,
    location: {
      "@type": "Place",
      name: studio.name,
    },
  }));
}
