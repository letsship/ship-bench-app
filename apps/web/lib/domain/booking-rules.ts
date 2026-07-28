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

// Any existing active booking for this session — a confirmed seat, an
// attendance already recorded, OR a waitlist entry — blocks another booking
// attempt. A waitlisted member has no seat, but they are already in line for
// one, so a repeat submit must be rejected with the same "already booked"
// conflict rather than adding a second waitlist row. (Seat accounting for
// occupancy is handled separately in lib/domain/capacity.ts.)
const ACTIVE_MEMBER_BOOKING = new Set(["booked", "attended", "waitlisted"]);

// Decide whether a member may book a session, and if so, whether the booking is
// confirmed or waitlisted.
export function canBook(context: BookingContext): BookingDecision {
  if (context.sessionStatus !== "scheduled") return { ok: false, reason: "session_cancelled" };
  if (!isBefore(context.now, context.sessionStartsAt)) {
    return { ok: false, reason: "session_started" };
  }
  if (context.memberStatus !== "active") return { ok: false, reason: "member_inactive" };
  if (context.memberBookings.some((booking) => ACTIVE_MEMBER_BOOKING.has(booking.status))) {
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
