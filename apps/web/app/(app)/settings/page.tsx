import { resolveStudio } from "@/lib/services/context";
import { PageHeader } from "../_components/ui";
import { saveSettings } from "./actions";

export const dynamic = "force-dynamic";

const NOTIFY_TOGGLES = [
  { name: "notifyBookingConfirmations", label: "Booking confirmations" },
  { name: "notifyCancellations", label: "Cancellations" },
  { name: "notifyWaitlistPromotions", label: "Waitlist promotions" },
  { name: "notifyInvoices", label: "Invoices" },
  { name: "notifyBookingReminders", label: "Class reminders" },
] as const;

export default async function SettingsPage() {
  const { ctx } = await resolveStudio();
  const { settings, studio } = ctx;

  return (
    <>
      <PageHeader title="Settings" subtitle={`${studio.name} · ${studio.timezone}`} />
      <form action={saveSettings} className="sb-card max-w-xl space-y-6 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="sb-label" htmlFor="taxPercent">
              Tax rate (%)
            </label>
            <input
              id="taxPercent"
              name="taxPercent"
              type="number"
              step="0.1"
              min={0}
              className="sb-input"
              defaultValue={(settings.taxRateBps / 100).toString()}
            />
          </div>
          <div>
            <label className="sb-label" htmlFor="cancellationWindowHours">
              Cancellation window (hours)
            </label>
            <input
              id="cancellationWindowHours"
              name="cancellationWindowHours"
              type="number"
              min={0}
              className="sb-input"
              defaultValue={settings.cancellationWindowHours}
            />
          </div>
        </div>

        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="waitlistEnabled" defaultChecked={settings.waitlistEnabled} />
          Enable waitlists when a class is full
        </label>

        <fieldset className="space-y-2">
          <legend className="sb-label">Send notifications for</legend>
          {NOTIFY_TOGGLES.map((toggle) => (
            <label key={toggle.name} className="flex items-center gap-3 text-sm">
              <input type="checkbox" name={toggle.name} defaultChecked={settings[toggle.name]} />
              {toggle.label}
            </label>
          ))}
        </fieldset>

        <button type="submit" className="sb-btn sb-btn-primary">
          Save settings
        </button>
      </form>
    </>
  );
}
