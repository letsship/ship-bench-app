import type { Metadata, MetadataRoute } from "next";
import type { Studio } from "@/lib/db/types";

const DEFAULT_SITE_BASE_URL = "http://localhost:3000";

export interface StudioEventSession {
  id: string;
  classTypeName: string;
  startsAt: string;
  endsAt: string;
}

export interface StudioEventJsonLd {
  "@context": "https://schema.org";
  "@type": "Event";
  name: string;
  startDate: string;
  endDate: string;
  eventStatus: "https://schema.org/EventScheduled";
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode";
  location: {
    "@type": "Place";
    name: string;
    url: string;
  };
  organizer: {
    "@type": "Organization";
    name: string;
    url: string;
  };
  url: string;
}

function normalizedBaseUrl(baseUrl: string): string {
  return new URL(baseUrl).origin;
}

export function siteBaseUrl(): string {
  return normalizedBaseUrl(process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_BASE_URL);
}

export function studioPagePath(slug: string): string {
  return `/s/${encodeURIComponent(slug)}`;
}

export function studioPageUrl(baseUrl: string, slug: string): string {
  return new URL(studioPagePath(slug), `${normalizedBaseUrl(baseUrl)}/`).toString();
}

function studioDescription(studio: Studio): string {
  return `View upcoming classes at ${studio.name}, including class times and instructors, and book your next visit.`;
}

export function buildStudioMetadata(studio: Studio, baseUrl: string): Metadata {
  const title = `${studio.name} classes and schedule`;
  const description = studioDescription(studio);
  const url = studioPageUrl(baseUrl, studio.slug);

  return {
    metadataBase: new URL(`${normalizedBaseUrl(baseUrl)}/`),
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

export function buildStudioEventJsonLd(
  studio: Studio,
  sessions: readonly StudioEventSession[],
  baseUrl: string,
): StudioEventJsonLd[] {
  const studioUrl = studioPageUrl(baseUrl, studio.slug);

  return sessions.map((session) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: session.classTypeName,
    startDate: session.startsAt,
    endDate: session.endsAt,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: studio.name,
      url: studioUrl,
    },
    organizer: {
      "@type": "Organization",
      name: studio.name,
      url: studioUrl,
    },
    url: `${studioUrl}#class-${encodeURIComponent(session.id)}`,
  }));
}

export function buildStudioSitemapEntries(
  studios: readonly Studio[],
  baseUrl: string,
): MetadataRoute.Sitemap {
  return studios.map((studio) => ({
    url: studioPageUrl(baseUrl, studio.slug),
    lastModified: studio.createdAt,
    changeFrequency: "daily",
    priority: 0.8,
  }));
}

export function buildRobotsMetadata(baseUrl: string): MetadataRoute.Robots {
  const normalizedUrl = normalizedBaseUrl(baseUrl);

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: new URL("/sitemap.xml", `${normalizedUrl}/`).toString(),
  };
}
