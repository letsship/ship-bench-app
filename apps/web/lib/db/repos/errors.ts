// Repository-layer error types. These signal persistence-seam violations to the
// service layer, which translates them to HTTP responses. The repos layer stays
// clear of HTTP concerns (status codes, response formats) and lets callers decide
// how to respond.

export class DuplicateActiveBookingError extends Error {
  constructor(
    message: string = "A member cannot have multiple active bookings for the same session",
  ) {
    super(message);
    this.name = "DuplicateActiveBookingError";
  }
}

export function isDuplicateActiveBookingError(
  error: unknown,
): error is DuplicateActiveBookingError {
  return error instanceof DuplicateActiveBookingError;
}
