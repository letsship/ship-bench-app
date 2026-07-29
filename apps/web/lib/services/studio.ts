import type { Repositories } from "@/lib/db/repos/types";
import type { Studio, StudioSettings } from "@/lib/db/types";
import { HttpError } from "@/lib/http";
import type { PublicClass, PublicStudio } from "@/lib/services/public-studio";
import { listSessions } from "@/lib/services/classes";

export interface StudioContext {
  studio: Studio;
  settings: StudioSettings;
}

// Studiobook is single-studio in the demo dataset: resolve the one studio and
// its settings. A missing studio means the database was never seeded.
export async function getStudioContext(repos: Repositories): Promise<StudioContext> {
  const studio = await repos.studios.getFirst();
  if (!studio) {
    throw new HttpError(
      503,
      "not_provisioned",
      "No studio has been provisioned. Seed the database.",
    );
  }
  const settings = await repos.settings.getByStudioId(studio.id);
  if (!settings) {
    throw new HttpError(
      503,
      "not_provisioned",
      "Studio settings are missing. Reseed the database.",
    );
  }
  return { studio, settings };
}

export interface UpdateSettingsInput {
  taxRateBps?: number;
  cancellationWindowHours?: number;
  waitlistEnabled?: boolean;
  notifyBookingConfirmations?: boolean;
  notifyCancellations?: boolean;
  notifyWaitlistPromotions?: boolean;
  notifyInvoices?: boolean;
}

/**
 * Resolve a studio by its public slug plus its upcoming classes, or null when
 * no studio owns that slug (the caller turns null into a 404).
 *
 * Accepts Repositories by dependency injection so it can be unit-tested against
 * the in-memory fakes.
 */
export async function resolvePublicStudioPage(
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

export async function updateSettings(
  repos: Repositories,
  studioId: string,
  input: UpdateSettingsInput,
): Promise<StudioSettings> {
  return repos.settings.update(studioId, input);
}
