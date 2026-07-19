import type { Metadata } from "next";
import { resolveRepositories } from "@/lib/db/repos";
import type { Studio } from "@/lib/db/types";
import { listSessions } from "@/lib/services/classes";

// The public (no-auth) surface of a studio: what a prospective member — or a
// search-engine crawler — is allowed to see. Only the studio's public identity
// and its upcoming classes (name, time, instructor); never members, invoices,
// bookings, or occupancy. Shared by the /s/[slug] page, sitemap, and robots so
// the "what is public" rule lives in exactly one place.

export interface PublicClass {
  id: string;
  name: string;
  instructor: string;
  startsAt: string;
  endsAt: string;
}

export interface PublicStudio {
  studio: Studio;
  classes: PublicClass[];
}

export interface SchemaOrgEvent {
  "@context": string;
  "@type": string;
  name: string;
  startDate: string;
  location: {
    "@type": string;
    name: string;
    address?: {
      "@type": string;
      streetAddress?: string;
      addressLocality?: string;
      addressRegion?: string;
      postalCode?: string;
      addressCountry?: string;
    };
  };
}

// The site's public origin. Absolute URLs (canonical, Open Graph, sitemap) need
// one; it comes from NEXT_PUBLIC_SITE_URL in a real deployment and falls back to
// localhost for dev/build, matching Next's own metadataBase default.
export function publicBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function publicStudioUrl(slug: string): string {
  return `${publicBaseUrl()}/s/${slug}`;
}

// Resolve a studio by its public slug plus its upcoming classes, or null when no
// studio owns that slug (the page turns null into a 404).
export async function resolvePublicStudio(
  slug: string,
  now: Date = new Date(),
): Promise<PublicStudio | null> {
  const repos = await resolveRepositories();
  const studio = await repos.studios.getBySlug(slug);
  if (!studio) return null;
  const sessions = await listSessions(repos, studio.id, { from: now.toISOString() });
  const classes: PublicClass[] = sessions.map((session) => ({
    id: session.id,
    name: session.classTypeName,
    instructor: session.instructor,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
  }));
  return { studio, classes };
}

// Every studio that has a public page — the set the sitemap enumerates.
export async function listPublicStudios(): Promise<Studio[]> {
  const repos = await resolveRepositories();
  return repos.studios.listAll();
}

// Build the SEO metadata for a studio's public page.
export function buildStudioMetadata(studio: Studio, baseUrl?: string): Metadata {
  const url = baseUrl ?? publicBaseUrl();
  const canonicalUrl = `${url}/s/${studio.slug}`;
  const title = `${studio.name} — Classes & Bookings`;
  const description = `Discover upcoming classes at ${studio.name}. Browse instructors, times, and book your spot.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: canonicalUrl,
      siteName: "Studiobook",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

// Build schema.org Event JSON-LD for the studio's upcoming classes.
export function buildEventsJsonLd(studio: Studio, classes: PublicClass[]): SchemaOrgEvent[] {
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
