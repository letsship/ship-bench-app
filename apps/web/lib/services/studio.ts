import { eq } from "drizzle-orm";
import { studioSettings, studios } from "@/lib/db/schema";
import type { Studio, StudioSettings } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { HttpError } from "@/lib/http";

export interface StudioContext {
  studio: Studio;
  settings: StudioSettings;
}

// Studiobook is single-studio in the demo dataset: resolve the one studio and
// its settings. A missing studio means the database was never seeded.
export async function getStudioContext(db: Db): Promise<StudioContext> {
  const [studio] = await db.select().from(studios).limit(1);
  if (!studio) {
    throw new HttpError(503, "not_provisioned", "No studio has been provisioned. Run `pnpm db:seed`.");
  }
  const [settings] = await db
    .select()
    .from(studioSettings)
    .where(eq(studioSettings.studioId, studio.id))
    .limit(1);
  if (!settings) {
    throw new HttpError(503, "not_provisioned", "Studio settings are missing. Run `pnpm db:reset`.");
  }
  return { studio, settings };
}

export type NotificationSettingKey =
  | "notifyBookingConfirmations"
  | "notifyCancellations"
  | "notifyWaitlistPromotions"
  | "notifyInvoices";

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
  db: Db,
  studioId: string,
  input: UpdateSettingsInput,
): Promise<StudioSettings> {
  const [updated] = await db
    .update(studioSettings)
    .set(input)
    .where(eq(studioSettings.studioId, studioId))
    .returning();
  if (!updated) throw new HttpError(404, "not_found", "Studio settings not found");
  return updated;
}
