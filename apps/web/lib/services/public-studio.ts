import { resolveRepositories } from "@/lib/db/repos";
import type { Studio, StudioSettings } from "@/lib/db/types";
import { type SessionView, listSessions } from "@/lib/services/classes";

export interface PublicStudio {
  studio: Studio;
  settings: StudioSettings | null;
  sessions: SessionView[];
}

export async function getPublicStudioBySlug(slug: string): Promise<PublicStudio | null> {
  const repos = await resolveRepositories();
  const studio = await repos.studios.getBySlug(slug);
  if (!studio) return null;

  const [settings, sessions] = await Promise.all([
    repos.settings.getByStudioId(studio.id),
    listSessions(repos, studio.id, { from: new Date().toISOString() }),
  ]);

  return { studio, settings, sessions };
}

export async function listPublicStudios(): Promise<Studio[]> {
  const repos = await resolveRepositories();
  return repos.studios.listAll();
}
