// Shared repository-level errors. Both repository implementations (the
// in-memory fake and the Supabase adapter) throw these to signal a
// data-layer conflict that the service layer translates into an HTTP
// response. Keeping a single sentinel type means the service does not need
// to know which repository implementation it is talking to.

// Raised when an insert would create a second active (non-cancelled)
// booking for the same session + member. The booking service catches this
// and maps it to the existing 409 `booking_already_booked` conflict, so a
// losing concurrent double-submit gets the same response as a repeat on a
// confirmed seat.
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

export function isDuplicateActiveBookingError(error: unknown): error is DuplicateActiveBookingError {
  return error instanceof DuplicateActiveBookingError;
}
