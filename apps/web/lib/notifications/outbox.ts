import { eq, isNull } from "drizzle-orm";
import { newId } from "@/lib/db/ids";
import { members, notificationOutbox, studioSettings } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import type { NotificationKind, NotificationMessage, NotificationProvider } from "./types";

// Which studio setting gates each notification kind.
const SETTING_FOR_KIND = {
  booking_confirmation: "notifyBookingConfirmations",
  booking_cancellation: "notifyCancellations",
  waitlist_promotion: "notifyWaitlistPromotions",
  invoice_issued: "notifyInvoices",
} as const satisfies Record<NotificationKind, string>;

export interface OptOutContext {
  memberOptedOut: boolean;
  notifyBookingConfirmations: boolean;
  notifyCancellations: boolean;
  notifyWaitlistPromotions: boolean;
  notifyInvoices: boolean;
}

// A member opt-out wins over everything; otherwise the studio-level setting for
// the kind decides. Pure so both the dispatcher and tests share one rule.
export function shouldSend(kind: NotificationKind, context: OptOutContext): boolean {
  if (context.memberOptedOut) return false;
  return context[SETTING_FOR_KIND[kind]];
}

// Persist a notification as a pending outbox row. Delivery happens later in
// dispatchOutbox, so the write path stays fast and delivery is retryable.
export async function enqueueNotification(db: Db, message: NotificationMessage): Promise<string> {
  const id = newId("nof");
  await db.insert(notificationOutbox).values({
    id,
    memberId: message.recipient.memberId,
    kind: message.kind,
    payload: JSON.stringify({
      subject: message.subject,
      body: message.body,
      recipient: message.recipient,
      data: message.data,
    }),
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

// Deliver every pending outbox row (sentAt IS NULL) through the provider,
// skipping rows whose recipient/studio has opted out of that kind. Delivered
// and skipped rows are stamped with sentAt; a delivery failure leaves sentAt
// NULL so the row is retried on the next run.
export async function dispatchOutbox(
  db: Db,
  provider: NotificationProvider,
  options: DispatchOptions = {},
): Promise<DispatchSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const pending = await db
    .select({
      id: notificationOutbox.id,
      kind: notificationOutbox.kind,
      payload: notificationOutbox.payload,
      memberOptedOut: members.notificationsOptedOut,
      notifyBookingConfirmations: studioSettings.notifyBookingConfirmations,
      notifyCancellations: studioSettings.notifyCancellations,
      notifyWaitlistPromotions: studioSettings.notifyWaitlistPromotions,
      notifyInvoices: studioSettings.notifyInvoices,
    })
    .from(notificationOutbox)
    .innerJoin(members, eq(members.id, notificationOutbox.memberId))
    .innerJoin(studioSettings, eq(studioSettings.studioId, members.studioId))
    .where(isNull(notificationOutbox.sentAt));

  const summary: DispatchSummary = { sent: 0, skipped: 0, failed: 0 };

  for (const row of pending) {
    const kind = row.kind as NotificationKind;
    if (!shouldSend(kind, row)) {
      await db
        .update(notificationOutbox)
        .set({ sentAt: now(), error: "skipped:opted_out" })
        .where(eq(notificationOutbox.id, row.id));
      summary.skipped += 1;
      continue;
    }
    const payload = JSON.parse(row.payload) as {
      subject: string;
      body: string;
      recipient: NotificationMessage["recipient"];
      data: Record<string, unknown>;
    };
    try {
      const result = await provider.send({ kind, ...payload });
      await db
        .update(notificationOutbox)
        .set({ sentAt: now(), providerMessageId: result.providerMessageId, error: null })
        .where(eq(notificationOutbox.id, row.id));
      summary.sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("notification dispatch failed", { id: row.id, error: message });
      await db
        .update(notificationOutbox)
        .set({ error: message })
        .where(eq(notificationOutbox.id, row.id));
      summary.failed += 1;
    }
  }

  return summary;
}

// Convenience: enqueue then immediately dispatch. Used by route handlers that
// want a notification to go out within the same request.
export async function enqueueAndDispatch(
  db: Db,
  provider: NotificationProvider,
  message: NotificationMessage,
  options: DispatchOptions = {},
): Promise<DispatchSummary> {
  await enqueueNotification(db, message);
  return dispatchOutbox(db, provider, options);
}
