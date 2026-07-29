import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { NotificationKind, NotificationMessage, NotificationProvider } from "./types";

// Which studio setting gates each notification kind.
// Kinds without an entry (e.g. booking_reminder) have no studio-level toggle
// and are gated solely by the member opt-out flag.
const SETTING_FOR_KIND: Partial<Record<NotificationKind, string>> = {
  booking_confirmation: "notifyBookingConfirmations",
  booking_cancellation: "notifyCancellations",
  waitlist_promotion: "notifyWaitlistPromotions",
  invoice_issued: "notifyInvoices",
};

export interface OptOutContext {
  memberOptedOut: boolean;
  notifyBookingConfirmations: boolean;
  notifyCancellations: boolean;
  notifyWaitlistPromotions: boolean;
  notifyInvoices: boolean;
}

// A member opt-out wins over everything; otherwise the studio-level setting for
// the kind decides (if one exists — kinds without a toggle are gated by opt-out
// only). Pure so both the dispatcher and tests share one rule.
export function shouldSend(kind: NotificationKind, context: OptOutContext): boolean {
  if (context.memberOptedOut) return false;
  const field = SETTING_FOR_KIND[kind];
  if (!field) return true;
  return context[field as keyof OptOutContext] as boolean;
}

// Persist a notification as a pending outbox row. Delivery happens later in
// dispatchOutbox, so the write path stays fast and delivery is retryable.
export async function enqueueNotification(
  repos: Repositories,
  message: NotificationMessage,
): Promise<string> {
  const id = newId();
  await repos.outbox.insert({
    id,
    memberId: message.recipient.memberId,
    kind: message.kind,
    payload: JSON.stringify({
      subject: message.subject,
      body: message.body,
      recipient: message.recipient,
      data: message.data,
    }),
    createdAt: new Date().toISOString(),
    sentAt: null,
    providerMessageId: null,
    error: null,
  });
  return id;
}

export interface DispatchSummary {
  sent: number;
  skipped: number;
  failed: number;
}

export interface DispatchOptions {
  now?: () => string;
}

// Deliver every pending outbox row through the provider, skipping rows whose
// recipient/studio has opted out of that kind. Delivered and skipped rows are
// stamped with sentAt; a delivery failure leaves sentAt null so the row is
// retried on the next run.
export async function dispatchOutbox(
  repos: Repositories,
  provider: NotificationProvider,
  options: DispatchOptions = {},
): Promise<DispatchSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const pending = await repos.outbox.listPending();
  const summary: DispatchSummary = { sent: 0, skipped: 0, failed: 0 };

  for (const row of pending) {
    const kind = row.kind as NotificationKind;
    const member = await repos.members.getById(row.memberId);
    const settings = member ? await repos.settings.getByStudioId(member.studioId) : null;
    if (!member || !settings) {
      await repos.outbox.update(row.id, { sentAt: now(), error: "skipped:unresolved_recipient" });
      summary.skipped += 1;
      continue;
    }
    if (!shouldSend(kind, { memberOptedOut: member.notificationsOptedOut, ...settings })) {
      await repos.outbox.update(row.id, { sentAt: now(), error: "skipped:opted_out" });
      summary.skipped += 1;
      continue;
    }
    const payload = JSON.parse(row.payload) as Omit<NotificationMessage, "kind">;
    try {
      const result = await provider.send({ kind, ...payload });
      await repos.outbox.update(row.id, {
        sentAt: now(),
        providerMessageId: result.providerMessageId,
        error: null,
      });
      summary.sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("notification dispatch failed", { id: row.id, error: message });
      await repos.outbox.update(row.id, { error: message });
      summary.failed += 1;
    }
  }

  return summary;
}

// Convenience: enqueue then immediately dispatch. Used by services that want a
// notification to go out within the same request.
export async function enqueueAndDispatch(
  repos: Repositories,
  provider: NotificationProvider,
  message: NotificationMessage,
  options: DispatchOptions = {},
): Promise<DispatchSummary> {
  await enqueueNotification(repos, message);
  return dispatchOutbox(repos, provider, options);
}
