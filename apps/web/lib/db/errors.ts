// Driver-agnostic errors the repository layer can throw so services never
// need to know whether they're backed by Postgres, supabase-js, or the
// in-memory fake.

// Thrown by a bookings repo's insert when a second active (booked /
// waitlisted / attended) row already exists for the same member + session.
export class BookingConflictError extends Error {
  constructor(message = "A conflicting active booking already exists for this member and session") {
    super(message);
    this.name = "BookingConflictError";
  }
}
