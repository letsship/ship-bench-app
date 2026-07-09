import type { Repositories } from "@/lib/db/repos/types";
import type { Studio } from "@/lib/db/types";
import { HttpError } from "@/lib/http";
import { type SessionView, listSessions } from "./classes";

export interface PublicStudioView {
  studio: Studio;
  upcomingSessions: SessionView[];
}

// Public, unauthenticated lookup of a studio + its upcoming classes by slug —
// backs the SEO-facing `/s/[slug]` page, so it deliberately exposes nothing
// beyond what that page renders (no members, bookings, or invoices).
export async function getPublicStudioBySlug(
  repos: Repositories,
  slug: string,
): Promise<PublicStudioView> {
  const studio = await repos.studios.getBySlug(slug);
  if (!studio) throw new HttpError(404, "not_found", "Studio not found");
  const upcomingSessions = await listSessions(repos, studio.id, { from: new Date().toISOString() });
  return { studio, upcomingSessions };
}
