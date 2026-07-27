import type { Occupancy } from "./capacity";
import { hoursBetween, isBefore } from "./dates";

// Booking + cancellation policy. Pure decisions over minimal shapes so the
// API route handlers and tests can exercise every branch.

export type BookingStatus = "booked" | "waitlisted" | "attended" | "no_show" | "cancelled";

export type BookingDenyReason =
  | "session_cancelled"
  | "session_started"
  | "member_inactive"
  | "already_booked"
  | "session_full_no_waitlist";

export type BookingDecision =
  | { ok: true; status: "booked" | "waitlisted" }
  | {
      ok: false;
      reason: BookingDenyReason;
    };

export interface BookingContext {
  sessionStatus: string;
  sessionStartsAt: string;
  memberStatus: string;
  // This member's existing bookings for THIS session.
  memberBookings: readonly { status: string }[];
  occupancy: Occupancy;
  waitlistEnabled: boolean;
  now: string;
}

// Statuses that mean the member already holds a live claim on this session: a
// confirmed seat, a recorded attendance, or a waitlist entry. A waitlist entry
// holds no seat, but it does hold a place in the queue — booking again while it
// stands would list the member twice and promote them twice. `cancelled` and
// `no_show` are excluded, which is what lets a cancelled member rebook.
//
// The partial unique index in `packages/db/migrations/0002_unique_active_booking.sql`
// and the guard in `lib/db/repos/fakes.ts` both mirror this set. Keep all three
// in step: dropping a status here without dropping it there wrongly blocks a
// rebooking, and the reverse reopens the double-booking hole.
export const ACTIVE_MEMBER_BOOKING_STATUSES = ["booked", "waitlisted", "attended"] as const;

export function isActiveBooking(status: string): boolean {
  return (ACTIVE_MEMBER_BOOKING_STATUSES as readonly string[]).includes(status);
}

// Decide whether a member may book a session, and if so, whether the booking is
// confirmed or waitlisted.
export function canBook(context: BookingContext): BookingDecision {
  if (context.sessionStatus !== "scheduled") return { ok: false, reason: "session_cancelled" };
  if (!isBefore(context.now, context.sessionStartsAt)) {
    return { ok: false, reason: "session_started" };
  }
  if (context.memberStatus !== "active") return { ok: false, reason: "member_inactive" };
  if (context.memberBookings.some((booking) => isActiveBooking(booking.status))) {
    return { ok: false, reason: "already_booked" };
  }
  if (context.occupancy.isFull) {
    if (!context.waitlistEnabled) return { ok: false, reason: "session_full_no_waitlist" };
    return { ok: true, status: "waitlisted" };
  }
  return { ok: true, status: "booked" };
}

export type CancellationDenyReason = "already_cancelled" | "session_passed";

export type CancellationDecision =
  { ok: true; refundEligible: boolean } | { ok: false; reason: CancellationDenyReason };

export interface CancellationContext {
  bookingStatus: string;
  sessionStartsAt: string;
  cancellationWindowHours: number;
  now: string;
}

// Decide whether a booking may be cancelled and whether it earns a refund.
// A cancellation inside the studio's cancellation window is allowed but not
// refunded.
export function canCancel(context: CancellationContext): CancellationDecision {
  if (context.bookingStatus === "cancelled") return { ok: false, reason: "already_cancelled" };
  if (!isBefore(context.now, context.sessionStartsAt)) {
    return { ok: false, reason: "session_passed" };
  }
  const hoursUntilStart = hoursBetween(context.now, context.sessionStartsAt);
  return { ok: true, refundEligible: hoursUntilStart >= context.cancellationWindowHours };
}

// When a confirmed seat frees up, the earliest-booked waitlisted entry is
// promoted. Returns its id, or null when the waitlist is empty.
export function pickWaitlistPromotion(
  waitlisted: readonly { id: string; bookedAt: string }[],
): string | null {
  if (waitlisted.length === 0) return null;
  return [...waitlisted].sort((a, b) => a.bookedAt.localeCompare(b.bookedAt))[0].id;
}
