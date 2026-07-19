import type { Metadata } from "next";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function canonicalFor(slug: string): string {
  return `${siteUrl()}/s/${slug}`;
}

export function buildStudioMetadata(studio: Studio, classes: PublicClass[]): Metadata {
  const canonical = canonicalFor(studio.slug);
  const upcomingCount = classes.length;
  const title = `${studio.name} - Classes & Bookings`;
  const description =
    upcomingCount > 0
      ? `Discover ${upcomingCount} upcoming classes at ${studio.name}. Book your next class today.`
      : `${studio.name} - Browse our fitness classes and book your next session.`;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical,
    },
  };
}

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

export function buildStudioEventJsonLd(studio: Studio, classes: PublicClass[]): EventJsonLd[] {
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
