import { resolveRepositories } from "@/lib/db/repos";
import type { Repositories } from "@/lib/db/repos/types";
import type { Studio } from "@/lib/db/types";
import { listSessions } from "@/lib/services/classes";

// The public (no-auth) surface of a studio: what a prospective member — or a
// search-engine crawler — is allowed to see. Only the studio's public identity
// and its upcoming classes (name, time, instructor); never members, invoices,
// bookings, or occupancy. Shared by the /s/[slug] page, sitemap, and robots so
// the "what is public" rule lives in exactly one place.
//
// Services accept their `Repositories` by dependency injection (per the services
// seam) so they stay unit-testable against the in-memory fakes; the thin
// no-arg wrappers below resolve repositories themselves for the route-handler /
// page / sitemap call sites that don't need to inject them.

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

// Resolve a studio by its public slug plus its upcoming classes, or null when no
// studio owns that slug (the page turns null into a 404). Sessions are enriched
// with the class-type name and instructor, reusing the existing listSessions
// logic and filtered to startsAt >= now.
export async function getPublicStudioBySlug(
  repos: Repositories,
  slug: string,
): Promise<PublicStudio | null> {
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
export async function listPublicStudios(repos: Repositories): Promise<Studio[]> {
  return repos.studios.listAll();
}

// Thin wrappers that resolve their own repositories, for call sites that don't
// inject them (the page, sitemap, robots). Unit tests use the DI overloads.
export async function resolvePublicStudio(slug: string): Promise<PublicStudio | null> {
  const repos = await resolveRepositories();
  return getPublicStudioBySlug(repos, slug);
}

export async function resolvePublicStudios(): Promise<Studio[]> {
  const repos = await resolveRepositories();
  return listPublicStudios(repos);
}
