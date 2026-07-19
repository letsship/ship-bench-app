import type { Metadata } from "next";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";

export interface EventJsonLd {
  "@context": string;
  "@type": string;
  name: string;
  startDate: string;
  location: {
    "@type": string;
    name: string;
  };
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function studioUrl(slug: string): string {
  return `${siteUrl()}/s/${slug}`;
}

export function buildStudioMetadata(studio: Studio, _classes: PublicClass[]): Metadata {
  const title = `${studio.name} Classes`;
  const description = `Explore upcoming classes at ${studio.name}. Book your spot in yoga, fitness, and more.`;
  const url = studioUrl(studio.slug);

  return {
    title,
    description,
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url,
      siteName: studio.name,
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

export function buildEventJsonLd(studio: Studio, classes: PublicClass[]): EventJsonLd[] {
  return classes.map((cls) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: cls.name,
    startDate: cls.startsAt,
    location: {
      "@type": "Place",
      name: studio.name,
    },
  }));
}
