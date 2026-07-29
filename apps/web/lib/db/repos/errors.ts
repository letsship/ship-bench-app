// Repo-layer error signalling a unique-violation on the active-booking index
// (packages/db/migrations/0002_bookings_unique_active_index.sql). Both repository
// implementations throw this so the service layer can map it back to the existing
// 409 "already has a booking" conflict without the repo knowing about HTTP.

export class DuplicateActiveBookingError extends Error {
  constructor(message = "Member already has an active booking for this session") {
    super(message);
    this.name = "DuplicateActiveBookingError";
  }
}
