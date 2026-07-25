// The provider-agnostic notification contract. The outbox dispatcher and the
// message builders depend only on this interface; concrete vendors (today:
// Resend) implement it.

export type NotificationKind =
  "booking_confirmation" | "booking_cancellation" | "waitlist_promotion" | "invoice_issued";

export const NOTIFICATION_KINDS: readonly NotificationKind[] = [
  "booking_confirmation",
  "booking_cancellation",
  "waitlist_promotion",
  "invoice_issued",
];

export interface NotificationRecipient {
  memberId: string;
  email: string;
  name: string;
}

export interface NotificationMessage {
  kind: NotificationKind;
  recipient: NotificationRecipient;
  subject: string;
  body: string;
  // Structured context persisted alongside the outbox row.
  data: Record<string, unknown>;
}

export interface SendResult {
  providerMessageId: string;
}

export interface NotificationProvider {
  readonly name: string;
  send(message: NotificationMessage): Promise<SendResult>;
}
