import type { Repositories } from "@/lib/db/repos/types";
import type { Studio, StudioSettings } from "@/lib/db/types";
import { HttpError } from "@/lib/http";

export interface StudioContext {
  studio: Studio;
  settings: StudioSettings;
}

// Studiobook is single-studio in the demo dataset: resolve the one studio and
// its settings. A missing studio means the database was never seeded.
export async function getStudioContext(repos: Repositories): Promise<StudioContext> {
  const studio = await repos.studios.getFirst();
  if (!studio) {
    throw new HttpError(503, "not_provisioned", "No studio has been provisioned. Seed the database.");
  }
  const settings = await repos.settings.getByStudioId(studio.id);
  if (!settings) {
    throw new HttpError(503, "not_provisioned", "Studio settings are missing. Reseed the database.");
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

export async function updateSettings(
  repos: Repositories,
  studioId: string,
  input: UpdateSettingsInput,
): Promise<StudioSettings> {
  return repos.settings.update(studioId, input);
}
