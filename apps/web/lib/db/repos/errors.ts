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