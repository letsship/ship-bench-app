import type { Repositories } from "@/lib/db/repos/types";
import type { Studio } from "@/lib/db/types";

// Unauthenticated read path for the public studio page (`/s/[slug]`). Unlike
// `getStudioContext`/`resolveStudio` (single-studio, cookie-authenticated
// flow), this resolves a studio by its public slug and only ever returns data
// safe to show an anonymous visitor.

export interface PublicClassSession {
  id: string;
  name: string;
  startsAt: string;
  instructor: string;
}

export interface PublicStudio {
  studio: Studio;
  upcomingSessions: PublicClassSession[];
}

export async function getPublicStudioBySlug(
  repos: Repositories,
  slug: string,
): Promise<PublicStudio | null> {
  const studio = await repos.studios.getBySlug(slug);
  if (!studio) return null;

  const [sessions, classTypes] = await Promise.all([
    repos.classSessions.listByStudio(studio.id, { from: new Date().toISOString() }),
    repos.classTypes.listByStudio(studio.id),
  ]);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));

  return {
    studio,
    upcomingSessions: sessions.map((session) => ({
      id: session.id,
      name: typeById.get(session.classTypeId)?.name ?? "Class",
      startsAt: session.startsAt,
      instructor: session.instructor,
    })),
  };
}
