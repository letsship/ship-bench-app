// Shared repository-level errors that the service layer translates into HTTP
// responses without depending on driver-specific error shapes. Both repository
// implementations (Supabase + in-memory fakes) throw these so the service can
// catch a single typed error.

// Thrown when inserting a booking would give a member a second non-cancelled
// booking for the same class session. The Supabase repo maps a Postgres
// unique-violation (SQLSTATE 23505) on the `bookings` table to this; the
// in-memory fakes enforce the same invariant up front. The service turns it
// into the standard `booking_already_booked` 409.
export class DuplicateBookingError extends Error {
  readonly sessionId: string;
  readonly memberId: string;
  constructor(sessionId: string, memberId: string) {
    super("Member already has an active booking for this session");
    this.name = "DuplicateBookingError";
    this.sessionId = sessionId;
    this.memberId = memberId;
  }
}
