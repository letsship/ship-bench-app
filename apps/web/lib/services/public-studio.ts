import { resolveRepositories } from "@/lib/db/repos";
import type { Studio } from "@/lib/db/types";
import { publicStudioAbsoluteUrl, siteUrl } from "@/lib/seo";
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

// The site's public origin. Absolute URLs (canonical, Open Graph, sitemap) need
// one; the rules live in @/lib/seo (unit-tested, single source of truth) and
// these wrappers keep service callers concise.
export function publicBaseUrl(): string {
  return siteUrl();
}

export function publicStudioUrl(slug: string): string {
  return publicStudioAbsoluteUrl(slug, siteUrl());
}

// Resolve a studio by its public slug plus its upcoming classes, or null when no
// studio owns that slug (the page turns null into a 404).
export async function resolvePublicStudio(slug: string): Promise<PublicStudio | null> {
  const repos = await resolveRepositories();
  const studio = await repos.studios.getBySlug(slug);
  if (!studio) return null;
  const sessions = await listSessions(repos, studio.id, { from: new Date().toISOString() });
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
