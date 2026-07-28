// Repository-layer errors. These let the service layer react to persistence
// failures without coupling to a specific driver (supabase-js, pg, etc.).

/**
 * Thrown by a repository's bookings.insert when an active booking already exists
 * for the same (sessionId, memberId) pair. The service catches this and
 * translates it to a user-facing 409 conflict.
 */
export class DuplicateActiveBookingError extends Error {
  readonly code = "DUPLICATE_ACTIVE_BOOKING";
  constructor(sessionId: string, memberId: string) {
    super(
      `Duplicate active booking for session ${sessionId}, member ${memberId}`,
    );
    this.name = "DuplicateActiveBookingError";
  }
}

/** Type guard for `DuplicateActiveBookingError`. */
export function isDuplicateActiveBookingError(
  error: unknown,
): error is DuplicateActiveBookingError {
  return error instanceof DuplicateActiveBookingError;
}