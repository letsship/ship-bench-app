// Driver-agnostic repository errors. Every implementation of the repository
// seam raises these, so services can branch on a persistence conflict without
// importing supabase-js or knowing Postgres error codes.

// Raised by `bookings.insert` when the row would be a second *active* booking
// (see `ACTIVE_MEMBER_BOOKING_STATUSES`) for the same member + session. The
// service's `canBook` pre-check catches the sequential case; this closes the
// check-then-insert race two near-simultaneous submits open — a double-clicked
// `join` on a full class must not produce two waitlist rows.
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
