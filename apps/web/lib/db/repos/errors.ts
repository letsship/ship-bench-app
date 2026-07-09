// Driver-agnostic errors thrown by repository implementations to signal
// constraint violations that the service layer needs to react to, without
// leaking Postgres- or fake-store-specific details upward.

export class DuplicateActiveBookingError extends Error {
  constructor(memberId: string, sessionId: string) {
    super(`Member ${memberId} already has an active booking for session ${sessionId}`);
    this.name = "DuplicateActiveBookingError";
  }
}
