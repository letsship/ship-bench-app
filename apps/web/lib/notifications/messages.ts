import { formatMoney } from "@/lib/domain/money";
import type { NotificationMessage, NotificationRecipient } from "./types";

// Pure builders for each notification kind. They own subject/body copy so the
// outbox and the route handlers stay free of templating.

export interface SessionSummary {
  title: string;
  startsAt: string;
  instructor: string;
}

export function bookingConfirmation(
  recipient: NotificationRecipient,
  session: SessionSummary,
): NotificationMessage {
  return {
    kind: "booking_confirmation",
    recipient,
    subject: `You're booked: ${session.title}`,
    body: `Hi ${recipient.name}, your spot in ${session.title} with ${session.instructor} on ${session.startsAt} is confirmed. See you on the mat!`,
    data: { title: session.title, startsAt: session.startsAt },
  };
}

export function bookingCancellation(
  recipient: NotificationRecipient,
  session: SessionSummary,
  refundEligible: boolean,
): NotificationMessage {
  const refundLine = refundEligible
    ? "Your class credit has been returned."
    : "This cancellation is inside the cancellation window, so no credit was returned.";
  return {
    kind: "booking_cancellation",
    recipient,
    subject: `Cancelled: ${session.title}`,
    body: `Hi ${recipient.name}, your booking for ${session.title} on ${session.startsAt} is cancelled. ${refundLine}`,
    data: { title: session.title, startsAt: session.startsAt, refundEligible },
  };
}

export function waitlistPromotion(
  recipient: NotificationRecipient,
  session: SessionSummary,
): NotificationMessage {
  return {
    kind: "waitlist_promotion",
    recipient,
    subject: `A spot opened up: ${session.title}`,
    body: `Good news ${recipient.name}! A place in ${session.title} on ${session.startsAt} just opened and you're in.`,
    data: { title: session.title, startsAt: session.startsAt },
  };
}

export interface ReminderIds {
  bookingId: string;
  sessionId: string;
}

// `data` carries bookingId + sessionId so the reminder service can detect an
// already-queued reminder for a booking (idempotency key).
export function bookingReminder(
  recipient: NotificationRecipient,
  session: SessionSummary,
  ids: ReminderIds,
): NotificationMessage {
  return {
    kind: "booking_reminder",
    recipient,
    subject: `Reminder: ${session.title} starts soon`,
    body: `Hi ${recipient.name}, just a reminder that ${session.title} with ${session.instructor} starts on ${session.startsAt}. See you on the mat!`,
    data: {
      bookingId: ids.bookingId,
      sessionId: ids.sessionId,
      title: session.title,
      startsAt: session.startsAt,
    },
  };
}

export interface InvoiceSummary {
  number: string;
  totalCents: number;
  currency: string;
  dueAt: string | null;
}

export function invoiceIssued(
  recipient: NotificationRecipient,
  invoice: InvoiceSummary,
): NotificationMessage {
  const due = invoice.dueAt ? ` It's due by ${invoice.dueAt}.` : "";
  return {
    kind: "invoice_issued",
    recipient,
    subject: `Invoice ${invoice.number}`,
    body: `Hi ${recipient.name}, invoice ${invoice.number} for ${formatMoney(invoice.totalCents, invoice.currency)} is ready.${due}`,
    data: { number: invoice.number, totalCents: invoice.totalCents },
  };
}
