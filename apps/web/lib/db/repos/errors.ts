// Marker error thrown by BookingsRepo.insert() implementations when a new
// row would create a second active (booked/waitlisted) booking for the same
// member + session. Caught by the bookings service and translated into the
// same 409 the synchronous canBook() already-booked check throws, so races
// that slip past that check (e.g. a double-click) get an identical response.
export class DuplicateActiveBookingError extends Error {
  constructor() {
    super("A booking already exists for this member and session");
    this.name = "DuplicateActiveBookingError";
  }
}
