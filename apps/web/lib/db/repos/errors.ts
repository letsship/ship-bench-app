// Repository-seam errors shared by the Supabase and in-memory
// implementations. This module stays free of HTTP and framework concerns;
// services translate these errors at their own boundary (e.g. into a 409).

// Thrown by `bookings.insert` when the member already holds an active
// (booked / waitlisted / attended) booking for the same session. This is the
// application-level face of the partial unique index in
// supabase/migrations/0002_unique_active_booking.sql.
export class DuplicateActiveBookingError extends Error {
  constructor(sessionId: string, memberId: string) {
    super(`Member ${memberId} already has an active booking for session ${sessionId}`);
    this.name = "DuplicateActiveBookingError";
  }
}
