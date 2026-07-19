// Provider-agnostic error types raised by repository operations.

export class UniqueActiveBookingError extends Error {
  constructor(sessionId: string, memberId: string) {
    super(`Member ${memberId} already has an active booking for session ${sessionId}`);
    this.name = "UniqueActiveBookingError";
  }
}

export function isUniqueActiveBookingError(error: unknown): error is UniqueActiveBookingError {
  return error instanceof UniqueActiveBookingError;
}
