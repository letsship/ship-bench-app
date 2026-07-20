export class DuplicateActiveBookingError extends Error {
  constructor(
    public sessionId: string,
    public memberId: string,
  ) {
    super(`Duplicate active booking for session ${sessionId} and member ${memberId}`);
    this.name = "DuplicateActiveBookingError";
  }
}
