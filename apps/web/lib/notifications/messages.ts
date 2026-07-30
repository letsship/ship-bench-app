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

// `bookingId` is what the reminder job dedups on, so a repeated cron run does
// not queue a second reminder for the same seat.
export function bookingReminder(
  recipient: NotificationRecipient,
  session: SessionSummary,
  bookingId: string,
): NotificationMessage {
  return {
    kind: "booking_reminder",
    recipient,
    subject: `Reminder: ${session.title} tomorrow`,
    body: `Hi ${recipient.name}, this is a reminder that ${session.title} with ${session.instructor} starts on ${session.startsAt}. See you there!`,
    data: { bookingId, title: session.title, startsAt: session.startsAt },
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
