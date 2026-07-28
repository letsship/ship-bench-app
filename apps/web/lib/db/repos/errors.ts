// Shared repository error types. Both the Supabase and in-memory
// implementations throw these so services can translate them into a single
// HTTP error regardless of the persistence backend.

// Booking statuses that hold a place for a member in a class. This set must
// stay in sync with the partial unique index in
// packages/db/migrations/0002_unique_active_booking.sql and the domain's
// ACTIVE_MEMBER_BOOKING in lib/domain/booking-rules.ts.
export const ACTIVE_BOOKING_STATUSES: readonly string[] = [
  "booked",
  "waitlisted",
  "attended",
];

// Thrown when an insert would create a second active booking for the same
// member on the same session (i.e. it violates the one-active-booking
// invariant). Signals a 409 conflict at the service layer.
export class DuplicateActiveBookingError extends Error {
  readonly sessionId: string;
  readonly memberId: string;

  constructor(sessionId: string, memberId: string) {
    super(`Member ${memberId} already has an active booking for session ${sessionId}`);
    this.name = "DuplicateActiveBookingError";
    this.sessionId = sessionId;
    this.memberId = memberId;
  }
}
