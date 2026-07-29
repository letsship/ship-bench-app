import type { Metadata } from "next";
import type { Studio } from "@/lib/db/types";
import type { PublicClass } from "@/lib/services/public-studio";

export interface SeoContext {
  slug: string;
  sessions: PublicClass[];
  siteUrl: string;
}

/**
 * Build a Next Metadata object for a studio's public page.
 * Pure — no React, no side effects — so it is unit-testable directly.
 */
export function buildStudioMetadata(
  studio: Studio,
  ctx: SeoContext,
): Metadata {
  const canonical = `${ctx.siteUrl}/s/${ctx.slug}`;
  const description = `Book a class at ${studio.name}. View upcoming classes, schedules, and instructors.`;

  return {
    title: studio.name,
    description,
    alternates: { canonical },
    openGraph: {
      title: studio.name,
      description,
      type: "website",
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title: studio.name,
      description,
    },
  };
}

/**
 * Build the array of schema.org Event objects for JSON-LD, one per upcoming
 * class. Each event includes at least name, startDate, and location.
 */
export function buildStudioEventJsonLd(
  studio: Studio,
  sessions: PublicClass[],
  ctx: { siteUrl: string },
): Record<string, unknown>[] {
  return sessions.map((session) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: session.name,
    startDate: session.startsAt,
    endDate: session.endsAt,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: studio.name,
      address: { "@type": "PostalAddress" },
    },
  }));
}