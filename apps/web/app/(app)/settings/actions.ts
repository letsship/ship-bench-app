"use server";

import { revalidatePath } from "next/cache";
import { resolveStudio } from "@/lib/services/context";
import { updateSettings } from "@/lib/services/studio";

export async function saveSettings(formData: FormData): Promise<void> {
  const { repos, ctx } = await resolveStudio();
  const taxPercent = Number(formData.get("taxPercent") ?? 0);
  await updateSettings(repos, ctx.studio.id, {
    taxRateBps: Math.round(taxPercent * 100),
    cancellationWindowHours: Number(formData.get("cancellationWindowHours") ?? 12),
    waitlistEnabled: formData.get("waitlistEnabled") === "on",
    notifyBookingConfirmations: formData.get("notifyBookingConfirmations") === "on",
    notifyCancellations: formData.get("notifyCancellations") === "on",
    notifyWaitlistPromotions: formData.get("notifyWaitlistPromotions") === "on",
    notifyInvoices: formData.get("notifyInvoices") === "on",
    notifyBookingReminders: formData.get("notifyBookingReminders") === "on",
  });
  revalidatePath("/settings");
}
