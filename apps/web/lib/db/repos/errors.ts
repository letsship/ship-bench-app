// Thrown by a repository's `bookings.insert` when the member already has an
// active (non-cancelled) booking for the session — either caught by the fake's
// in-memory check or surfaced from the database's unique constraint. Callers
// above the repo seam react to this without knowing about Postgres error codes.
export class DuplicateBookingError extends Error {
  constructor() {
    super("Member already has an active booking for this session");
    this.name = "DuplicateBookingError";
  }
}
