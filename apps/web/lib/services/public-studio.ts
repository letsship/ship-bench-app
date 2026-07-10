import type { Repositories } from "@/lib/db/repos/types";
import type { Studio } from "@/lib/db/types";
import { listSessions, type SessionView } from "./classes";

// Public, unauthenticated read model for the /s/[slug] studio page: no repo
// call here ever requires a session, unlike everything under resolveStudio().

// Read directly rather than through lib/env's clientEnv(), which also requires
// Supabase vars that hermetic unit tests never set. Falls back to localhost so
// canonical URLs, the sitemap, and robots.txt still resolve to something valid
// in dev/test where NEXT_PUBLIC_SITE_URL is unset.
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function getStudioPageUrl(studio: Pick<Studio, "slug">): string {
  return `${getSiteUrl()}/s/${studio.slug}`;
}

export interface PublicStudioPage {
  studio: Studio;
  upcomingSessions: SessionView[];
}

export async function getPublicStudioPage(
  repos: Repositories,
  slug: string,
): Promise<PublicStudioPage | null> {
  const studio = await repos.studios.getBySlug(slug);
  if (!studio) return null;
  const upcomingSessions = await listSessions(repos, studio.id, { from: new Date().toISOString() });
  return { studio, upcomingSessions };
}

export function buildStudioMetaDescription(studio: Studio): string {
  return `See upcoming classes at ${studio.name} and sign in to book your spot.`;
}

interface StudioEvent {
  "@type": "Event";
  name: string;
  startDate: string;
  endDate: string;
  location: {
    "@type": "Place";
    name: string;
  };
  performer?: {
    "@type": "Person";
    name: string;
  };
  url: string;
}

export function buildStudioJsonLd(
  studio: Studio,
  sessions: SessionView[],
  canonicalUrl: string,
): StudioEvent[] {
  return sessions.map((session) => ({
    "@type": "Event",
    name: session.classTypeName,
    startDate: session.startsAt,
    endDate: session.endsAt,
    location: {
      "@type": "Place",
      name: studio.name,
    },
    performer: {
      "@type": "Person",
      name: session.instructor,
    },
    url: canonicalUrl,
  }));
}
