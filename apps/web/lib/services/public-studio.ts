import type { Repositories } from "@/lib/db/repos/types";
import type { Studio } from "@/lib/db/types";
import { HttpError } from "@/lib/http";
import { type SessionView, listSessions } from "@/lib/services/classes";

export interface PublicStudioView {
  studio: Studio;
  upcomingClasses: SessionView[];
}

// Public, unauthenticated lookup for the `/s/[slug]` page: resolves a studio by
// its public slug (404 when no studio has that slug) and its upcoming classes,
// reusing `listSessions` so class-type names and instructor fields aren't
// duplicated between the authenticated and public surfaces.
export async function getPublicStudioBySlug(
  repos: Repositories,
  slug: string,
  now: Date = new Date(),
): Promise<PublicStudioView> {
  const studio = await repos.studios.getBySlug(slug);
  if (!studio) {
    throw new HttpError(404, "not_found", "No studio matches this address");
  }
  const upcomingClasses = await listSessions(repos, studio.id, { from: now.toISOString() });
  return { studio, upcomingClasses };
}
