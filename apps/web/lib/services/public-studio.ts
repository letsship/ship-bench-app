import type { Repositories } from "@/lib/db/repos/types";
import type { Studio } from "@/lib/db/types";
import { listSessions } from "./classes";

// The public (unauthenticated) view of a studio's upcoming schedule, keyed by
// slug. Kept separate from `studio.ts`'s `getStudioContext` because that one
// throws on a missing studio (admin flow) and requires `settings` — the
// public page needs neither and must return `null` cleanly to trigger a 404.

export interface PublicClass {
  id: string;
  name: string;
  startsAt: string;
  instructor: string;
}

export interface PublicStudio {
  studio: Studio;
  classes: PublicClass[];
}

export async function getPublicStudioBySlug(
  repos: Repositories,
  slug: string,
  now: string = new Date().toISOString(),
): Promise<PublicStudio | null> {
  const studio = await repos.studios.getBySlug(slug);
  if (!studio) return null;

  const sessions = await listSessions(repos, studio.id, { from: now });
  const classes = sessions.map((session) => ({
    id: session.id,
    name: session.classTypeName,
    startsAt: session.startsAt,
    instructor: session.instructor,
  }));

  return { studio, classes };
}
